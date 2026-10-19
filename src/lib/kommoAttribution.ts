import { prisma } from '@/lib/prisma';
import { getKommoClient } from '@/lib/kommo-auth';
import { brPhoneVariants } from '@/lib/phone';
import { processLeadStageChange } from '@/lib/leadJourney';

// Writes a matched message's attribution (UTMs, click ids, resolved ad ids) onto the lead in
// Kommo. Shared by the inbound-message route (first attempt, inline), the retry cron and the
// manual "reenviar ao Kommo" button.
//
// Why retries exist: the Kommo lead is usually created by the messaging platform *after* the
// message reaches us, so the very first lookup often finds nothing. That used to be final
// (SKIPPED, never revisited) and left the lead without attribution. Now a miss keeps the message
// PENDING and tries again with backoff until the lead shows up or attempts run out.

// Wait before attempt N+1, indexed by how many attempts were already made. The lead usually
// shows up within seconds of the message (the messaging platform creates it right after), so the
// first retries are short; later ones back off. 10 attempts (the inline one + 9 retries) spanning
// about 35 minutes — a lead that still doesn't exist by then is not coming from this message.
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
// Rows older than this are never auto-retried (also bounds how far back stuck PENDING rows from
// before this feature are picked up).
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ResolvedAdMatch {
  confidence: 'id' | 'name' | null;
  adExternalId: string | null;
  campaignExternalId: string | null;
  adsetExternalId: string | null;
}

// Resolves the session's captured UTM values against the MappedAd catalog (see adCatalogSync.ts),
// preferring the platform's dynamic ID tokens ({{ad.id}}/{{campaign.id}} etc, landing in
// utmContent/utmCampaign) over legacy ads that only ever carried human-readable names — see plan
// doc "TrackFlow — resolução por ID com fallback por nome".
async function resolveAdMatch(
  clientId: string,
  session: { utmContent: string | null; utmCampaign: string | null },
): Promise<ResolvedAdMatch> {
  if (session.utmContent) {
    const byAdId = await prisma.mappedAd.findFirst({
      where: { clientId, adExternalId: session.utmContent },
    });
    if (byAdId) {
      return {
        confidence: 'id',
        adExternalId: byAdId.adExternalId,
        campaignExternalId: byAdId.campaignExternalId,
        adsetExternalId: byAdId.adsetExternalId,
      };
    }
  }

  if (session.utmCampaign) {
    const byCampaignId = await prisma.mappedAd.findFirst({
      where: { clientId, campaignExternalId: session.utmCampaign },
    });
    if (byCampaignId) {
      return {
        confidence: 'id',
        adExternalId: null,
        campaignExternalId: byCampaignId.campaignExternalId,
        adsetExternalId: null,
      };
    }
  }

  if (session.utmContent) {
    const byAdName = await prisma.mappedAd.findFirst({
      where: { clientId, adName: session.utmContent },
    });
    if (byAdName) {
      return {
        confidence: 'name',
        adExternalId: byAdName.adExternalId,
        campaignExternalId: byAdName.campaignExternalId,
        adsetExternalId: byAdName.adsetExternalId,
      };
    }
  }

  if (session.utmCampaign) {
    const byCampaignName = await prisma.mappedAd.findFirst({
      where: { clientId, campaignName: session.utmCampaign },
    });
    if (byCampaignName) {
      return {
        confidence: 'name',
        adExternalId: null,
        campaignExternalId: byCampaignName.campaignExternalId,
        adsetExternalId: null,
      };
    }
  }

  return { confidence: null, adExternalId: null, campaignExternalId: null, adsetExternalId: null };
}

type SyncOutcome = { status: string; error: string | null; kommoLeadId: string | null };

const EMPTY_AD_MATCH: ResolvedAdMatch = {
  confidence: null,
  adExternalId: null,
  campaignExternalId: null,
  adsetExternalId: null,
};

type KommoLeadSummary = { id: number; status_id?: number | null; pipeline_id?: number | null };

// Kommo's fixed system statuses for closed leads: 142 = won, 143 = lost.
const CLOSED_STATUS_IDS = new Set([142, 143]);

/**
 * The open Kommo lead this message belongs to, trying the Brazilian with/without-9 variants too.
 * A phone number can have several leads (earlier conversations, test runs, a closed deal), and
 * Kommo's text search has no useful default order — the old `limit: 1` could land on an old one,
 * so the attribution got written ("SYNCED") onto a lead nobody was looking at. Fetch a handful,
 * newest first, and take the newest one that is still open.
 *
 * Closed leads are deliberately never a fallback: when the contact's real (new) lead simply
 * doesn't exist yet — the usual race, the messaging platform creates it a moment after the
 * message arrives — an old closed lead is the only thing the search finds, and writing the
 * attribution there would be wrong. Returning null makes the caller retry until the new lead
 * shows up.
 */
async function findKommoLead(
  kommo: Awaited<ReturnType<typeof getKommoClient>>,
  waId: string,
): Promise<KommoLeadSummary | null> {
  for (const variant of brPhoneVariants(waId)) {
    const found = await kommo.leads.list({ query: variant, limit: 10, order_created_at: 'desc' });
    const open = (found._embedded?.leads ?? []).find(
      (l) => !CLOSED_STATUS_IDS.has(l.status_id ?? 0),
    );
    if (open) return open;
  }
  return null;
}

/**
 * One sync attempt for a stored TrackedMessage. Never throws: every outcome is recorded on the
 * row. A missing lead or a Kommo error leaves the row PENDING (retried by the cron) until
 * MAX_ATTEMPTS, then SKIPPED / FAILED.
 */
export async function syncTrackedMessageToKommo(trackedMessageId: string): Promise<SyncOutcome> {
  const message = await prisma.trackedMessage.findUnique({ where: { id: trackedMessageId } });
  if (!message) return { status: 'FAILED', error: 'Mensagem não encontrada', kommoLeadId: null };

  const attempts = message.kommoSyncAttempts + 1;
  const isLastAttempt = attempts >= MAX_ATTEMPTS;
  const record = async (data: Record<string, unknown>): Promise<SyncOutcome> => {
    const updated = await prisma.trackedMessage.update({
      where: { id: message.id },
      data: { kommoSyncAttempts: attempts, kommoLastAttemptAt: new Date(), ...data },
    });
    return {
      status: updated.kommoSyncStatus,
      error: updated.kommoSyncError,
      kommoLeadId: updated.kommoLeadId,
    };
  };
  // Not-yet-final outcome: stay PENDING so the cron picks it up again.
  const retryOrGiveUp = (
    reason: string,
    finalStatus: 'SKIPPED' | 'FAILED',
    adConfidence: string | null,
  ) =>
    isLastAttempt
      ? record({
          kommoSyncStatus: finalStatus,
          kommoSyncError: `${reason} (após ${attempts} tentativas)`,
          resolvedAdMatchConfidence: adConfidence,
        })
      : record({
          kommoSyncStatus: 'PENDING',
          kommoSyncError: `${reason} — nova tentativa automática (${attempts}/${MAX_ATTEMPTS})`,
          resolvedAdMatchConfidence: adConfidence,
        });

  let adConfidence: string | null = null;
  try {
    const [session, mappedAd] = await Promise.all([
      message.matchedPixelSessionId
        ? prisma.pixelSession.findUnique({ where: { id: message.matchedPixelSessionId } })
        : null,
      message.matchedMappedAdId
        ? prisma.mappedAd.findUnique({ where: { id: message.matchedMappedAdId } })
        : null,
    ]);

    const [client, integrationConfig, fieldMapping, adMatch] = await Promise.all([
      prisma.client.findUnique({ where: { id: message.clientId } }),
      prisma.integrationConfig.findFirst({
        where: { clientId: message.clientId, provider: 'KOMMO' },
      }),
      prisma.kommoFieldMapping.findUnique({ where: { clientId: message.clientId } }),
      // AD_CODE match already IS the ad, at full confidence — no UTM guessing needed. A
      // PixelSession match still goes through resolveAdMatch's UTM-based lookup.
      mappedAd
        ? Promise.resolve<ResolvedAdMatch>({
            confidence: 'id',
            adExternalId: mappedAd.adExternalId,
            campaignExternalId: mappedAd.campaignExternalId,
            adsetExternalId: mappedAd.adsetExternalId,
          })
        : session
          ? resolveAdMatch(message.clientId, session)
          : Promise.resolve(EMPTY_AD_MATCH),
    ]);
    adConfidence = adMatch.confidence;

    const subdomain = (integrationConfig?.config as { subdomain?: string } | null)?.subdomain;
    if (!client?.portalClientId || !subdomain || !fieldMapping) {
      // Configuration problem, not a timing one — retrying won't fix it.
      return record({
        kommoSyncStatus: 'SKIPPED',
        kommoSyncError: 'Kommo não configurado ou campos não mapeados',
        resolvedAdMatchConfidence: adConfidence,
      });
    }

    const kommo = await getKommoClient(subdomain, client.portalClientId);
    const lead = await findKommoLead(kommo, message.waId);
    if (!lead) {
      return retryOrGiveUp(
        `Nenhum lead encontrado no Kommo para ${message.waId}`,
        'SKIPPED',
        adConfidence,
      );
    }

    const fieldValue = (fieldId: number | null, value: string | null) =>
      fieldId && value ? { field_id: fieldId, values: [{ value }] } : null;

    const customFieldsValues = [
      // UTM/click-id fields only exist for a site-visit (PixelSession) match — a CTWA AD_CODE
      // match has no UTMs at all, just the ad identity itself.
      ...(session
        ? [
            fieldValue(fieldMapping.utmSourceFieldId, session.utmSource),
            fieldValue(fieldMapping.utmMediumFieldId, session.utmMedium),
            fieldValue(fieldMapping.utmCampaignFieldId, session.utmCampaign),
            fieldValue(fieldMapping.utmContentFieldId, session.utmContent),
            fieldValue(fieldMapping.utmTermFieldId, session.utmTerm),
            fieldValue(fieldMapping.fbclidFieldId, session.fbclid),
            fieldValue(fieldMapping.gclidFieldId, session.gclid),
            fieldValue(fieldMapping.gbraidFieldId, session.gbraid),
            fieldValue(fieldMapping.wbraidFieldId, session.wbraid),
          ]
        : []),
      // Resolved-by-catalog IDs — written alongside (not instead of) the raw UTM text above, so
      // the client can see both what was captured and what it resolved to.
      fieldValue(fieldMapping.campaignIdFieldId, adMatch.campaignExternalId),
      fieldValue(fieldMapping.adsetIdFieldId, adMatch.adsetExternalId),
      fieldValue(fieldMapping.adIdFieldId, adMatch.adExternalId),
    ].filter((v): v is NonNullable<typeof v> => v !== null);

    if (customFieldsValues.length === 0) {
      // Lead found, but nothing was actually resolved to write — no API call happened. Marking
      // this SYNCED would look like a successful write when it wasn't.
      return record({
        kommoLeadId: String(lead.id),
        kommoSyncStatus: 'SKIPPED',
        kommoSyncError:
          'Lead encontrado, mas nada foi resolvido pra gravar (confira o mapeamento de campos)',
        resolvedAdMatchConfidence: adConfidence,
      });
    }

    const updated = await kommo.leads.updateOne(lead.id, {
      custom_fields_values: customFieldsValues,
    });

    // "Kommo answered without an error" is not the same as "the fields were filled": a field id
    // that doesn't apply to leads can be accepted and silently dropped. PATCH /leads/{id} echoes
    // the lead back, so check each field we wrote actually came back with a value — if not, fail
    // loudly (and retry) instead of reporting SYNCED over an empty lead. Only checks presence of
    // the field, not the exact value, since Kommo may normalise what it stores.
    const echoed = (updated as { custom_fields_values?: unknown }).custom_fields_values;
    if (Array.isArray(echoed)) {
      const filled = new Set(
        (echoed as Array<{ field_id?: number; values?: unknown[] }>)
          .filter((f) => Array.isArray(f.values) && f.values.length > 0)
          .map((f) => f.field_id),
      );
      const missing = customFieldsValues.filter((f) => !filled.has(f.field_id));
      if (missing.length > 0) {
        throw new Error(
          `Kommo aceitou a gravação no lead ${lead.id}, mas não preencheu os campos ${missing
            .map((f) => f.field_id)
            .join(', ')} — confira se eles são campos de LEAD no mapeamento`,
        );
      }
    }
    console.log(
      `[kommoAttribution] wrote ${customFieldsValues.length} field(s) to Kommo lead ${lead.id} (message ${message.id})`,
    );

    // Mirror the lead into TrackFlow right now instead of waiting for Kommo's status_lead
    // webhook: that one only fires when a lead *changes* stage, not when it's created, so a
    // lead born in a mapped stage could stay invisible here (and fire no conversion event) until
    // someone moved it. processLeadStageChange is idempotent per (lead, stage, platform), so the
    // webhook arriving later for the same stage changes nothing. Best-effort: the attribution is
    // already written, so a failure here must not turn this attempt into a retry.
    if (lead.pipeline_id && lead.status_id) {
      try {
        await processLeadStageChange({
          clientId: message.clientId,
          kommoLeadId: lead.id,
          kommoPipelineId: lead.pipeline_id,
          kommoStatusId: lead.status_id,
          source: 'sync',
        });
      } catch (err) {
        console.error(`[kommoAttribution] failed to mirror lead ${lead.id} after sync`, err);
      }
    }

    return record({
      kommoLeadId: String(lead.id),
      kommoSyncStatus: 'SYNCED',
      kommoSyncedAt: new Date(),
      kommoSyncError: null,
      resolvedAdMatchConfidence: adConfidence,
    });
  } catch (err) {
    return retryOrGiveUp(err instanceof Error ? err.message : String(err), 'FAILED', adConfidence);
  }
}

/** Manual retry (the "reenviar ao Kommo" button): starts a fresh retry cycle for the message. */
export async function resyncTrackedMessage(trackedMessageId: string): Promise<SyncOutcome> {
  await prisma.trackedMessage.update({
    where: { id: trackedMessageId },
    data: { kommoSyncAttempts: 0, kommoSyncStatus: 'PENDING' },
  });
  return syncTrackedMessageToKommo(trackedMessageId);
}

/**
 * Cron entry point: re-attempts PENDING messages whose backoff delay has elapsed. Runs every
 * minute; a PENDING row with no attempt yet is one whose inline attempt never recorded
 * (crashed mid-request), picked up after a short grace period.
 */
export async function retryPendingKommoSyncs(): Promise<{ attempted: number; synced: number }> {
  const now = Date.now();
  const pending = await prisma.trackedMessage.findMany({
    where: {
      kommoSyncStatus: 'PENDING',
      createdAt: { gte: new Date(now - RETRY_WINDOW_MS) },
      OR: [{ matchedPixelSessionId: { not: null } }, { matchedMappedAdId: { not: null } }],
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  let attempted = 0;
  let synced = 0;
  for (const message of pending) {
    const delay =
      message.kommoSyncAttempts === 0
        ? 120_000
        : RETRY_DELAYS_MS[Math.min(message.kommoSyncAttempts, RETRY_DELAYS_MS.length) - 1];
    const lastAttempt = (message.kommoLastAttemptAt ?? message.createdAt).getTime();
    if (now - lastAttempt < delay) continue;

    attempted++;
    const outcome = await syncTrackedMessageToKommo(message.id);
    if (outcome.status === 'SYNCED') synced++;
  }
  return { attempted, synced };
}
