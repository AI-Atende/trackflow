import type { CustomField, KommoClient, Lead as KommoLead } from 'kommo-aiatende-api';
import type { KommoFieldMapping, JourneyStage as JourneyStageRow } from '@generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getKommoClientForClient } from '@/lib/kommo-auth';
import { sendMetaConversionEvent } from '@/lib/meta/capi';
import { uploadGoogleConversion } from '@/lib/google/conversionUpload';

export type StageChangeSource = 'webhook' | 'manual' | 'api';

interface ProcessStageChangeInput {
  clientId: string;
  kommoLeadId: number;
  kommoPipelineId: number;
  kommoStatusId: number;
  source: StageChangeSource;
}

interface KommoAttribution {
  waId: string | null;
  fbclid: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  matchedMappedAdId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  saleValue: number | null;
}

/**
 * Reads attribution off an already-fetched Kommo lead (+ its main contact) — the same fieldIds
 * KommoFieldMapping already uses to WRITE fbclid/gclid/gbraid/wbraid/adId (see syncToKommo in
 * api/internal/messages/received/route.ts). Closes the loop without a new join through
 * PixelSession/TrackedMessage. Pure/no API calls of its own beyond the contact fetch — callers
 * fetch the lead itself however fits their situation: one at a time via leads.getById
 * (processLeadStageChange) or in bulk via leads.list (importExistingLeadsFromKommo).
 */
async function extractAttributionFromKommoLead(
  kommo: KommoClient,
  fieldMapping: KommoFieldMapping | null,
  clientId: string,
  lead: KommoLead,
): Promise<KommoAttribution> {
  let waId: string | null = null;
  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  const mainContactRef = lead._embedded?.contacts?.[0];
  if (mainContactRef) {
    const contact = await kommo.contacts.getById(mainContactRef.id);
    const contactFields = contact?.custom_fields_values as CustomField[] | null | undefined;

    const phoneField = contactFields?.find((f) => f.field_code === 'PHONE');
    const rawPhone = phoneField?.values?.[0]?.value;
    if (rawPhone !== undefined && rawPhone !== null) {
      const digits = String(rawPhone).replace(/\D/g, '');
      if (digits) waId = digits;
    }

    // Contact's email field can hold several entries (work/personal/other) — prefer the one
    // tagged WORK (a commercial email matches better for B2B leads), else take whatever's there.
    const emailField = contactFields?.find((f) => f.field_code === 'EMAIL');
    const emailValue =
      emailField?.values?.find((v) => v.enum_code === 'WORK') ?? emailField?.values?.[0];
    if (emailValue?.value) email = String(emailValue.value);

    firstName = contact?.first_name || null;
    lastName = contact?.last_name || null;
    if (!firstName && !lastName && contact?.name) {
      // Some Kommo setups only ever populate the single "name" field, not first/last —
      // best-effort split so Meta/Google still get something for fn/ln.
      const parts = contact.name.trim().split(/\s+/);
      firstName = parts[0] ?? null;
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
    }
  }

  const saleValue = typeof lead.price === 'number' ? lead.price : null;

  const leadFields = lead.custom_fields_values as CustomField[] | null | undefined;
  const findFieldValue = (fieldId: number | null | undefined): string | null => {
    if (!fieldId) return null;
    const field = leadFields?.find((f) => f.field_id === fieldId);
    const value = field?.values?.[0]?.value;
    return value !== undefined && value !== null ? String(value) : null;
  };

  const fbclid = findFieldValue(fieldMapping?.fbclidFieldId);
  const gclid = findFieldValue(fieldMapping?.gclidFieldId);
  const gbraid = findFieldValue(fieldMapping?.gbraidFieldId);
  const wbraid = findFieldValue(fieldMapping?.wbraidFieldId);
  const adExternalId = findFieldValue(fieldMapping?.adIdFieldId);

  let matchedMappedAdId: string | null = null;
  if (adExternalId) {
    const mappedAd = await prisma.mappedAd.findFirst({ where: { clientId, adExternalId } });
    matchedMappedAdId = mappedAd?.id ?? null;
  }

  return {
    waId,
    fbclid,
    gclid,
    gbraid,
    wbraid,
    matchedMappedAdId,
    email,
    firstName,
    lastName,
    saleValue,
  };
}

type AttributionType = 'TRACKED' | 'EXTERNAL' | 'UNTRACKED';

function decideAttributionType(
  lead: {
    fbclid: string | null;
    gclid: string | null;
    gbraid: string | null;
    wbraid: string | null;
    matchedMappedAdId: string | null;
  },
  hasMatchedMessage: boolean,
): AttributionType {
  if (lead.fbclid || lead.gclid || lead.gbraid || lead.wbraid || lead.matchedMappedAdId) {
    return 'TRACKED';
  }
  return hasMatchedMessage ? 'EXTERNAL' : 'UNTRACKED';
}

/**
 * Classifies how a lead reached the funnel: 'TRACKED' (a click id, or resolved to a registered
 * MappedAd — what already fires conversions today), 'EXTERNAL' (some message matched a
 * PixelSession/code/UTM, but never resolved to a registered ad — a bio link, an in-person
 * partner referral, etc.), or 'UNTRACKED' (no matched message at all — direct WhatsApp contact,
 * no signal whatsoever). Drives the /leads UI badge and, when a client opts in via
 * MetaAdAccount.sendUnattributedConversions, whether non-TRACKED leads still fire Meta events
 * (see fireConversionEvents below).
 */
async function classifyAttribution(
  clientId: string,
  lead: {
    waId: string | null;
    fbclid: string | null;
    gclid: string | null;
    gbraid: string | null;
    wbraid: string | null;
    matchedMappedAdId: string | null;
  },
): Promise<AttributionType> {
  if (!lead.waId) return decideAttributionType(lead, false);
  const matchedMessage = await prisma.trackedMessage.findFirst({
    where: { clientId, waId: lead.waId, matchStrategy: { not: 'UNMATCHED' } },
    select: { id: true },
  });
  return decideAttributionType(lead, Boolean(matchedMessage));
}

/**
 * Ranks a lead's current Kommo status against every JourneyStage mapped in that SAME pipeline,
 * using the pipeline's real status order (PipelineStatus.sort) — not an exact status_id match.
 * Kommo pipelines are ordered: reaching a later status implies having passed every earlier one,
 * even ones the client never explicitly mapped (e.g. an intermediate "Triagem iniciada" between
 * two mapped stages). `reachedStages` is every mapped stage at or before the lead's position
 * (ascending); `currentStage` is the most advanced one — null if the lead hasn't reached the
 * first mapped stage yet. Stages mapped to a different pipeline never apply (a lead lives in one
 * pipeline at a time).
 */
async function resolveReachedStages(
  kommo: KommoClient,
  clientId: string,
  kommoPipelineId: number,
  targetStatusId: number,
  statusSortCache?: Map<number, Map<number, number>>,
): Promise<{ currentStage: JourneyStageRow | null; reachedStages: JourneyStageRow[] }> {
  let sortById = statusSortCache?.get(kommoPipelineId);
  if (!sortById) {
    const res = await kommo.pipelines.listStatuses(kommoPipelineId);
    sortById = new Map((res._embedded?.statuses ?? []).map((s) => [s.id, s.sort]));
    statusSortCache?.set(kommoPipelineId, sortById);
  }

  const targetSort = sortById.get(targetStatusId);
  if (targetSort === undefined) return { currentStage: null, reachedStages: [] };

  const journeyStages = await prisma.journeyStage.findMany({
    where: { clientId, kommoPipelineId },
  });
  const ranked = journeyStages
    .map((stage) => ({ stage, sort: sortById!.get(stage.kommoStatusId) }))
    .filter((x): x is { stage: JourneyStageRow; sort: number } => x.sort !== undefined)
    .filter((x) => x.sort <= targetSort)
    .sort((a, b) => a.sort - b.sort);

  const reachedStages = ranked.map((x) => x.stage);
  return {
    currentStage: reachedStages.length > 0 ? reachedStages[reachedStages.length - 1] : null,
    reachedStages,
  };
}

/**
 * Single entry point for "this lead just moved to this Kommo pipeline/status" — called by the
 * Kommo webhook (status_lead), the manual Leads UI, and the internal API for other systems.
 * No-ops if the lead hasn't reached any mapped JourneyStage yet. Fires the configured Meta/Google
 * conversion event(s) for every stage newly reached (see resolveReachedStages) — exactly once per
 * (lead, stage, platform), guarded by ConversionEventLog's unique constraint, so this correctly
 * handles both normal sequential progression and a lead jumping past several mapped stages at once.
 */
export async function processLeadStageChange(input: ProcessStageChangeInput): Promise<void> {
  const { clientId, kommoLeadId, kommoPipelineId, kommoStatusId, source } = input;

  const kommoConn = await getKommoClientForClient(clientId);
  if (!kommoConn) {
    console.warn(
      `[leadJourney] client ${clientId}: Kommo not configured, can't resolve lead ${kommoLeadId}`,
    );
    return;
  }
  const { kommo } = kommoConn;

  const { currentStage, reachedStages } = await resolveReachedStages(
    kommo,
    clientId,
    kommoPipelineId,
    kommoStatusId,
  );
  if (!currentStage) return;

  const existingLead = await prisma.lead.findUnique({
    where: { clientId_kommoLeadId: { clientId, kommoLeadId } },
  });
  const stageChanged = !existingLead || existingLead.currentJourneyStageId !== currentStage.id;

  let attribution: KommoAttribution | null = null;
  if (!existingLead || !existingLead.waId) {
    const [fieldMapping, kommoLead] = await Promise.all([
      prisma.kommoFieldMapping.findUnique({ where: { clientId } }),
      kommo.leads.getById(kommoLeadId, { with: ['contacts'] }),
    ]);
    if (kommoLead) {
      attribution = await extractAttributionFromKommoLead(kommo, fieldMapping, clientId, kommoLead);
    }
  }

  const attributionType = await classifyAttribution(clientId, {
    waId: attribution?.waId ?? existingLead?.waId ?? null,
    fbclid: attribution?.fbclid ?? existingLead?.fbclid ?? null,
    gclid: attribution?.gclid ?? existingLead?.gclid ?? null,
    gbraid: attribution?.gbraid ?? existingLead?.gbraid ?? null,
    wbraid: attribution?.wbraid ?? existingLead?.wbraid ?? null,
    matchedMappedAdId: attribution?.matchedMappedAdId ?? existingLead?.matchedMappedAdId ?? null,
  });

  const lead = await prisma.lead.upsert({
    where: { clientId_kommoLeadId: { clientId, kommoLeadId } },
    create: {
      clientId,
      kommoLeadId,
      currentJourneyStageId: currentStage.id,
      attributionType,
      ...(attribution ?? {}),
    },
    update: {
      currentJourneyStageId: currentStage.id,
      attributionType,
      ...(attribution ?? {}),
    },
  });

  console.log(
    `[leadJourney] client ${clientId}: lead ${kommoLeadId} -> stage "${currentStage.label}" ` +
      `(source=${source}, changed=${stageChanged}, reached=[${reachedStages.map((s) => s.label).join(', ')}])`,
  );

  if (!stageChanged) return;

  for (const stage of reachedStages) {
    await fireConversionEvents(clientId, lead, stage);
  }
}

const IMPORT_PAGE_SIZE = 250;

/**
 * One-time backfill: pulls every Kommo lead in a pipeline that has at least one mapped
 * JourneyStage, ranks each one's current status the same way processLeadStageChange does (see
 * resolveReachedStages — position-based, not exact match, so a lead already past "Lead novo"
 * still counts as having reached it), and mirrors it into Lead. Deliberately does NOT call
 * fireConversionEvents. These leads may have reached their stage months ago; firing a batch of
 * "Purchase"/"Lead" events with today's timestamp would skew Meta/Google's value-based
 * optimization. Only stage changes from here on (webhook/manual/API) fire events — this just
 * gets the journey's picture of "who's where" caught up to reality.
 */
export async function importExistingLeadsFromKommo(
  clientId: string,
): Promise<{ imported: number; skipped: number }> {
  // Checked before touching Kommo at all — no journey configured means nothing to import
  // regardless of connection state, and this is the more informative message for that case
  // ("configure a jornada primeiro" beats a confusing "Kommo not configured" when it might be).
  const journeyStages = await prisma.journeyStage.findMany({ where: { clientId } });
  if (journeyStages.length === 0) return { imported: 0, skipped: 0 };

  const [kommoConn, fieldMapping] = await Promise.all([
    getKommoClientForClient(clientId),
    prisma.kommoFieldMapping.findUnique({ where: { clientId } }),
  ]);
  if (!kommoConn) throw new Error('Kommo não configurado para este cliente');
  const { kommo } = kommoConn;

  const pipelineIds = [...new Set(journeyStages.map((s) => s.kommoPipelineId))];
  const statusSortCache = new Map<number, Map<number, number>>();

  let imported = 0;
  let skipped = 0;

  for (const pipelineId of pipelineIds) {
    let page = 1;
    for (;;) {
      const res = await kommo.leads.list({
        filter_pipeline_id: [pipelineId],
        with: ['contacts'],
        limit: IMPORT_PAGE_SIZE,
        page,
      });
      const leads = res._embedded?.leads ?? [];
      if (leads.length === 0) break;

      for (const lead of leads) {
        if (lead.status_id == null) {
          skipped++;
          continue;
        }
        try {
          const { currentStage } = await resolveReachedStages(
            kommo,
            clientId,
            pipelineId,
            lead.status_id,
            statusSortCache,
          );
          if (!currentStage) {
            skipped++;
            continue;
          }

          const attribution = await extractAttributionFromKommoLead(
            kommo,
            fieldMapping,
            clientId,
            lead,
          );
          const attributionType = await classifyAttribution(clientId, attribution);
          await prisma.lead.upsert({
            where: { clientId_kommoLeadId: { clientId, kommoLeadId: lead.id } },
            create: {
              clientId,
              kommoLeadId: lead.id,
              currentJourneyStageId: currentStage.id,
              attributionType,
              ...attribution,
            },
            update: {
              currentJourneyStageId: currentStage.id,
              attributionType,
              ...attribution,
            },
          });
          imported++;
        } catch (err) {
          console.error(`[leadJourney] import: failed lead ${lead.id} for client ${clientId}`, err);
          skipped++;
        }
      }

      if (leads.length < IMPORT_PAGE_SIZE) break;
      page++;
    }
  }

  console.log(
    `[leadJourney] client ${clientId}: imported ${imported} existing lead(s), skipped ${skipped}`,
  );

  return { imported, skipped };
}

async function fireConversionEvents(
  clientId: string,
  lead: NonNullable<Awaited<ReturnType<typeof prisma.lead.findUnique>>>,
  journeyStage: JourneyStageRow,
): Promise<void> {
  const targets: { platform: 'META' | 'GOOGLE'; eventName: string }[] = [];

  if (journeyStage.metaEventName) {
    // TRACKED leads always fire, same as before this field existed. A non-TRACKED lead (no
    // click id, no registered-ad match) only fires if the client explicitly opted in — sending
    // conversions for unattributed leads by default would misrepresent ad performance.
    let allowed = lead.attributionType === 'TRACKED';
    if (!allowed) {
      const metaAccounts = await prisma.metaAdAccount.findMany({ where: { clientId } });
      const account = metaAccounts.find((a) => a.status === 'ACTIVE') ?? metaAccounts[0];
      allowed = account?.sendUnattributedConversions ?? false;
    }
    if (allowed) targets.push({ platform: 'META', eventName: journeyStage.metaEventName });
  }

  // GOOGLE: unchanged regardless of attributionType — uploadGoogleConversion already hard-
  // requires gclid/gbraid/wbraid, which a non-TRACKED lead never has, so it naturally no-ops via
  // that existing guard. No opt-in exists for Google yet (would need a different API — Enhanced
  // Conversions for Leads — to accept a lead with only hashed email/phone).
  if (journeyStage.googleConversionActionId) {
    targets.push({ platform: 'GOOGLE', eventName: journeyStage.googleConversionActionId });
  }

  for (const target of targets) {
    // The @@unique([leadId, journeyStageId, platform]) constraint is the real idempotency guard —
    // this pre-check just avoids a noisy failed-insert in the common case (webhook redelivery).
    const already = await prisma.conversionEventLog.findUnique({
      where: {
        leadId_journeyStageId_platform: {
          leadId: lead.id,
          journeyStageId: journeyStage.id,
          platform: target.platform,
        },
      },
    });
    if (already) continue;

    const log = await prisma.conversionEventLog.create({
      data: {
        clientId,
        leadId: lead.id,
        journeyStageId: journeyStage.id,
        platform: target.platform,
        eventName: target.eventName,
        status: 'PENDING',
      },
    });

    await attemptSendConversionEvent(
      log.id,
      clientId,
      lead,
      target.platform,
      target.eventName,
      journeyStage.label,
    );
  }
}

/** Adds a tag (by name — Kommo creates it if it doesn't exist yet) to a lead without touching its
 * existing tags, via Kommo's dedicated tags endpoint (unlike a general lead update, which would
 * replace the tag list). Best-effort: a client working the lead in Kommo sees the accumulated
 * conversion history as tags, even mid-conversation — but a failure here shouldn't undo an
 * already-confirmed conversion send. */
async function tagKommoLead(clientId: string, kommoLeadId: number, tagName: string): Promise<void> {
  try {
    const kommoConn = await getKommoClientForClient(clientId);
    if (!kommoConn) return;
    await kommoConn.kommo.tags.updateForOne('leads', kommoLeadId, {
      _embedded: { tags: [{ name: tagName }] },
    });
  } catch (err) {
    console.error(`[leadJourney] failed to tag Kommo lead ${kommoLeadId} with "${tagName}"`, err);
  }
}

interface ConversionLead {
  id: string;
  kommoLeadId: number;
  waId: string | null;
  fbclid: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  saleValue: number | null;
}

/** Sends one ConversionEventLog row, updating it to SENT/FAILED — shared by the inline attempt
 * (fireConversionEvents, right after creating the PENDING row) and conversionEventRetryJob's
 * sweep over leftover PENDING/FAILED rows. Tags the Kommo lead only after a confirmed SENT — a
 * tagging failure never flips an already-successful send back to FAILED. */
export async function attemptSendConversionEvent(
  logId: string,
  clientId: string,
  lead: ConversionLead,
  platform: 'META' | 'GOOGLE',
  eventName: string,
  stageLabel: string,
): Promise<void> {
  try {
    const responseDetail =
      platform === 'META'
        ? await sendMetaConversionEvent({ clientId, lead, eventName })
        : await uploadGoogleConversion({ clientId, lead, conversionActionId: eventName });
    await prisma.conversionEventLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, responseDetail },
    });
  } catch (err) {
    await prisma.conversionEventLog.update({
      where: { id: logId },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : String(err),
        attempts: { increment: 1 },
      },
    });
    return;
  }

  await tagKommoLead(clientId, lead.kommoLeadId, stageLabel);
}

const MAX_RETRY_ATTEMPTS = 5;

/** Sweeps PENDING/FAILED ConversionEventLog rows (under the attempt cap) and retries sending them
 * — catches anything the inline best-effort attempt left behind (a transient network error, the
 * process restarting mid-send, etc). Registered in instrumentation.ts alongside the ad-catalog
 * sync cron. */
export async function retryPendingConversionEvents(): Promise<void> {
  const logs = await prisma.conversionEventLog.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: MAX_RETRY_ATTEMPTS } },
    include: { lead: true, journeyStage: true },
  });

  for (const log of logs) {
    await attemptSendConversionEvent(
      log.id,
      log.clientId,
      log.lead,
      log.platform,
      log.eventName,
      log.journeyStage.label,
    );
  }
}
