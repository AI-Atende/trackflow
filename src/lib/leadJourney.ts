import type { CustomField } from 'kommo-aiatende-api';
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

const EMPTY_ATTRIBUTION: KommoAttribution = {
  waId: null,
  fbclid: null,
  gclid: null,
  gbraid: null,
  wbraid: null,
  matchedMappedAdId: null,
  email: null,
  firstName: null,
  lastName: null,
  saleValue: null,
};

/**
 * Reads a lead's attribution back from its own Kommo custom fields — the same fieldIds
 * KommoFieldMapping already uses to WRITE fbclid/gclid/gbraid/wbraid/adId (see syncToKommo in
 * api/internal/messages/received/route.ts). Closes the loop without a new join through
 * PixelSession/TrackedMessage. Also fetches the lead's main contact to normalize its phone
 * number into the same digits-only format TrackedMessage.waId already uses.
 */
async function fetchLeadAttributionFromKommo(
  clientId: string,
  kommoLeadId: number,
): Promise<KommoAttribution> {
  const [kommoConn, fieldMapping] = await Promise.all([
    getKommoClientForClient(clientId),
    prisma.kommoFieldMapping.findUnique({ where: { clientId } }),
  ]);
  if (!kommoConn) return EMPTY_ATTRIBUTION;
  const { kommo } = kommoConn;

  const lead = await kommo.leads.getById(kommoLeadId, { with: ['contacts'] });
  if (!lead) return EMPTY_ATTRIBUTION;

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

/**
 * Single entry point for "this lead just moved to this Kommo pipeline/status" — called by the
 * Kommo webhook (status_lead), the manual Leads UI, and the internal API for other systems.
 * No-ops if no JourneyStage is configured for this pipeline/status (not every Kommo stage needs
 * to fire an event). Fires the configured Meta/Google conversion event(s) exactly once per
 * (lead, stage, platform) — see ConversionEventLog's unique constraint.
 */
export async function processLeadStageChange(input: ProcessStageChangeInput): Promise<void> {
  const { clientId, kommoLeadId, kommoPipelineId, kommoStatusId, source } = input;

  const journeyStage = await prisma.journeyStage.findUnique({
    where: {
      clientId_kommoPipelineId_kommoStatusId: { clientId, kommoPipelineId, kommoStatusId },
    },
  });
  if (!journeyStage) return;

  const existingLead = await prisma.lead.findUnique({
    where: { clientId_kommoLeadId: { clientId, kommoLeadId } },
  });
  const stageChanged = !existingLead || existingLead.currentJourneyStageId !== journeyStage.id;

  const attribution =
    !existingLead || !existingLead.waId
      ? await fetchLeadAttributionFromKommo(clientId, kommoLeadId)
      : null;

  const lead = await prisma.lead.upsert({
    where: { clientId_kommoLeadId: { clientId, kommoLeadId } },
    create: {
      clientId,
      kommoLeadId,
      currentJourneyStageId: journeyStage.id,
      ...(attribution ?? {}),
    },
    update: {
      currentJourneyStageId: journeyStage.id,
      ...(attribution ?? {}),
    },
  });

  console.log(
    `[leadJourney] client ${clientId}: lead ${kommoLeadId} -> stage "${journeyStage.label}" (source=${source}, changed=${stageChanged})`,
  );

  if (!stageChanged) return;

  await fireConversionEvents(clientId, lead, journeyStage);
}

async function fireConversionEvents(
  clientId: string,
  lead: NonNullable<Awaited<ReturnType<typeof prisma.lead.findUnique>>>,
  journeyStage: NonNullable<Awaited<ReturnType<typeof prisma.journeyStage.findUnique>>>,
): Promise<void> {
  const targets: { platform: 'META' | 'GOOGLE'; eventName: string }[] = [];
  if (journeyStage.metaEventName)
    targets.push({ platform: 'META', eventName: journeyStage.metaEventName });
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

    await attemptSendConversionEvent(log.id, clientId, lead, target.platform, target.eventName);
  }
}

/** Sends one ConversionEventLog row, updating it to SENT/FAILED — shared by the inline attempt
 * (fireConversionEvents, right after creating the PENDING row) and conversionEventRetryJob's
 * sweep over leftover PENDING/FAILED rows. */
export async function attemptSendConversionEvent(
  logId: string,
  clientId: string,
  lead: {
    id: string;
    waId: string | null;
    fbclid: string | null;
    gclid: string | null;
    gbraid: string | null;
    wbraid: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    saleValue: number | null;
  },
  platform: 'META' | 'GOOGLE',
  eventName: string,
): Promise<void> {
  try {
    if (platform === 'META') {
      await sendMetaConversionEvent({ clientId, lead, eventName });
    } else {
      await uploadGoogleConversion({ clientId, lead, conversionActionId: eventName });
    }
    await prisma.conversionEventLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
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
  }
}

const MAX_RETRY_ATTEMPTS = 5;

/** Sweeps PENDING/FAILED ConversionEventLog rows (under the attempt cap) and retries sending them
 * — catches anything the inline best-effort attempt left behind (a transient network error, the
 * process restarting mid-send, etc). Registered in instrumentation.ts alongside the ad-catalog
 * sync cron. */
export async function retryPendingConversionEvents(): Promise<void> {
  const logs = await prisma.conversionEventLog.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: MAX_RETRY_ATTEMPTS } },
    include: { lead: true },
  });

  for (const log of logs) {
    await attemptSendConversionEvent(log.id, log.clientId, log.lead, log.platform, log.eventName);
  }
}
