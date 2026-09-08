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

async function syncToKommo(
  clientId: string,
  waId: string,
  session: NonNullable<Awaited<ReturnType<typeof prisma.pixelSession.findFirst>>>,
  trackedMessageId: string,
): Promise<void> {
  const [client, integrationConfig, fieldMapping] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.integrationConfig.findFirst({ where: { clientId, provider: 'KOMMO' } }),
    prisma.kommoFieldMapping.findUnique({ where: { clientId } }),
  ]);

  const subdomain = (integrationConfig?.config as { subdomain?: string } | null)?.subdomain;
  if (!client?.portalClientId || !subdomain || !fieldMapping) {
    await prisma.trackedMessage.update({
      where: { id: trackedMessageId },
      data: {
        kommoSyncStatus: 'SKIPPED',
        kommoSyncError: 'Kommo não configurado ou campos não mapeados',
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
  ].filter((v): v is NonNullable<typeof v> => v !== null);

  if (customFieldsValues.length > 0) {
    await kommo.leads.updateOne(lead.id, { custom_fields_values: customFieldsValues });
  }

  await prisma.trackedMessage.update({
    where: { id: trackedMessageId },
    data: { kommoLeadId: String(lead.id), kommoSyncStatus: 'SYNCED', kommoSyncedAt: new Date() },
  });
}
