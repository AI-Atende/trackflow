import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getKommoClient } from '@/lib/kommo-auth';
import { extractInvisibleCode, extractVisibleCode } from '@/lib/tracking-codes';

const TIME_WINDOW_MINUTES = 30;

type MatchStrategy = 'CODE_INVISIBLE' | 'CODE_VISIBLE' | 'TIME_WINDOW' | 'UNMATCHED';

// POST /api/internal/messages/received — relayed by the portal (app/api/webhooks/messaging/
// [clientId] there) after it verifies the inbound WhatsApp message's signature. Auth: shared
// x-api-key, same as /api/internal/clients/status. Always stores a TrackedMessage row before
// anything else — the Kommo write below is a best-effort projection on top of it, never the
// only copy (see plan doc "TrackFlow como rastreador de leads").
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!process.env.TRACKFLOW_API_KEY || apiKey !== process.env.TRACKFLOW_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { portalClientId, waId, text, receivedAt } = body ?? {};
  if (!portalClientId || !waId || typeof text !== 'string') {
    return NextResponse.json(
      { error: 'portalClientId, waId e text são obrigatórios' },
      { status: 400 },
    );
  }

  const client = await prisma.client.findUnique({ where: { portalClientId } });
  if (!client) {
    // Client never logged in via SSO yet — nothing to attribute against. Not an error from
    // the portal's point of view (mirrors /api/internal/clients/status's no-op behavior).
    return NextResponse.json({ success: true, skipped: 'unknown client' });
  }

  const { matchStrategy, matchedSession } = await matchSession(client.id, text);

  const trackedMessage = await prisma.trackedMessage.create({
    data: {
      clientId: client.id,
      waId,
      text,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      matchStrategy,
      matchedPixelSessionId: matchedSession?.id ?? null,
      matchedTrackingLinkId: matchedSession?.lastTrackingLinkId ?? null,
      kommoSyncStatus: matchedSession ? 'PENDING' : 'SKIPPED',
    },
  });

  if (matchedSession) {
    await prisma.pixelSession.update({
      where: { id: matchedSession.id },
      data: { matchedAt: new Date() },
    });

    try {
      await syncToKommo(client.id, waId, matchedSession, trackedMessage.id);
    } catch (err) {
      await prisma.trackedMessage.update({
        where: { id: trackedMessage.id },
        data: {
          kommoSyncStatus: 'FAILED',
          kommoSyncError: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return NextResponse.json({ success: true, matchStrategy, trackedMessageId: trackedMessage.id });
}

async function matchSession(
  clientId: string,
  text: string,
): Promise<{
  matchStrategy: MatchStrategy;
  matchedSession: Awaited<ReturnType<typeof prisma.pixelSession.findFirst>> | null;
}> {
  const invisibleCode = extractInvisibleCode(text);
  if (invisibleCode) {
    const session = await prisma.pixelSession.findUnique({ where: { sessionCode: invisibleCode } });
    if (session && session.clientId === clientId) {
      return { matchStrategy: 'CODE_INVISIBLE', matchedSession: session };
    }
  }

  const visibleCode = extractVisibleCode(text);
  if (visibleCode) {
    const session = await prisma.pixelSession.findUnique({ where: { sessionCode: visibleCode } });
    if (session && session.clientId === clientId) {
      return { matchStrategy: 'CODE_VISIBLE', matchedSession: session };
    }
  }

  const since = new Date(Date.now() - TIME_WINDOW_MINUTES * 60_000);
  const fallback = await prisma.pixelSession.findFirst({
    where: { clientId, matchedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  });
  if (fallback) {
    return { matchStrategy: 'TIME_WINDOW', matchedSession: fallback };
  }

  return { matchStrategy: 'UNMATCHED', matchedSession: null };
}

interface ResolvedAdMatch {
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

async function syncToKommo(
  clientId: string,
  waId: string,
  session: NonNullable<Awaited<ReturnType<typeof prisma.pixelSession.findFirst>>>,
  trackedMessageId: string,
): Promise<void> {
  const [client, integrationConfig, fieldMapping, adMatch] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.integrationConfig.findFirst({ where: { clientId, provider: 'KOMMO' } }),
    prisma.kommoFieldMapping.findUnique({ where: { clientId } }),
    resolveAdMatch(clientId, session),
  ]);

  const subdomain = (integrationConfig?.config as { subdomain?: string } | null)?.subdomain;
  if (!client?.portalClientId || !subdomain || !fieldMapping) {
    await prisma.trackedMessage.update({
      where: { id: trackedMessageId },
      data: {
        kommoSyncStatus: 'SKIPPED',
        kommoSyncError: 'Kommo não configurado ou campos não mapeados',
        resolvedAdMatchConfidence: adMatch.confidence,
      },
    });
    return;
  }

  const kommo = await getKommoClient(subdomain, client.portalClientId);

  const found = await kommo.leads.list({ query: waId, limit: 1 });
  const lead = found._embedded?.leads?.[0];
  if (!lead) {
    await prisma.trackedMessage.update({
      where: { id: trackedMessageId },
      data: {
        kommoSyncStatus: 'SKIPPED',
        kommoSyncError: `Nenhum lead encontrado no Kommo para ${waId}`,
        resolvedAdMatchConfidence: adMatch.confidence,
      },
    });
    return;
  }

  const fieldValue = (fieldId: number | null, value: string | null) =>
    fieldId && value ? { field_id: fieldId, values: [{ value }] } : null;

  const customFieldsValues = [
    fieldValue(fieldMapping.utmSourceFieldId, session.utmSource),
    fieldValue(fieldMapping.utmMediumFieldId, session.utmMedium),
    fieldValue(fieldMapping.utmCampaignFieldId, session.utmCampaign),
    fieldValue(fieldMapping.utmContentFieldId, session.utmContent),
    fieldValue(fieldMapping.utmTermFieldId, session.utmTerm),
    fieldValue(fieldMapping.fbclidFieldId, session.fbclid),
    fieldValue(fieldMapping.gclidFieldId, session.gclid),
    // Resolved-by-catalog IDs — written alongside (not instead of) the raw UTM text above, so
    // the client can see both what was captured and what it resolved to.
    fieldValue(fieldMapping.campaignIdFieldId, adMatch.campaignExternalId),
    fieldValue(fieldMapping.adsetIdFieldId, adMatch.adsetExternalId),
    fieldValue(fieldMapping.adIdFieldId, adMatch.adExternalId),
  ].filter((v): v is NonNullable<typeof v> => v !== null);

  if (customFieldsValues.length === 0) {
    // Lead found, but the matched session had no UTM/click-id to write — nothing was actually
    // sent to Kommo. Marking this SYNCED (as before) was misleading: it looked like a
    // successful write when no API call ever happened.
    await prisma.trackedMessage.update({
      where: { id: trackedMessageId },
      data: {
        kommoLeadId: String(lead.id),
        kommoSyncStatus: 'SKIPPED',
        kommoSyncError: 'Lead encontrado, mas a sessão não tinha UTM/click-id pra gravar',
        resolvedAdMatchConfidence: adMatch.confidence,
      },
    });
    return;
  }

  await kommo.leads.updateOne(lead.id, { custom_fields_values: customFieldsValues });

  await prisma.trackedMessage.update({
    where: { id: trackedMessageId },
    data: {
      kommoLeadId: String(lead.id),
      kommoSyncStatus: 'SYNCED',
      kommoSyncedAt: new Date(),
      resolvedAdMatchConfidence: adMatch.confidence,
    },
  });
}
