import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncTrackedMessageToKommo } from '@/lib/kommoAttribution';
import { extractInvisibleCode, extractVisibleCode } from '@/lib/tracking-codes';
import { brPhoneVariants } from '@/lib/phone';

const TIME_WINDOW_MINUTES = 30;
// A number that already had a message attributed within this many days is a returning contact
// (follow-ups, a longer conversation), not a new visitor — see hasRecentAttribution.
const RETURNING_CONTACT_DAYS = 7;

type MatchStrategy = 'CODE_INVISIBLE' | 'CODE_VISIBLE' | 'TIME_WINDOW' | 'AD_CODE' | 'UNMATCHED';

type PixelSessionRow = Awaited<ReturnType<typeof prisma.pixelSession.findFirst>>;
type MappedAdRow = Awaited<ReturnType<typeof prisma.mappedAd.findFirst>>;

// E.164 phone numbers have at most 15 digits. WhatsApp group ids ("1203634...@g.us") are 18 —
// they are conversations, not leads, and must never take part in attribution: a group message
// arriving right after a redirect-link visit would otherwise be matched to it by the TIME_WINDOW
// fallback and consume that visitor's session.
const MAX_PHONE_DIGITS = 15;

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
  const { portalClientId, waId, text, receivedAt, phoneNumberId, channel, ctwaClid } = body ?? {};
  if (!portalClientId || !waId || typeof text !== 'string') {
    return NextResponse.json(
      { error: 'portalClientId, waId e text são obrigatórios' },
      { status: 400 },
    );
  }

  if (String(waId).replace(/\D/g, '').length > MAX_PHONE_DIGITS) {
    return NextResponse.json({ success: true, skipped: 'group conversation' });
  }

  const client = await prisma.client.findUnique({ where: { portalClientId } });
  if (!client) {
    // Client never logged in via SSO yet — nothing to attribute against. Not an error from
    // the portal's point of view (mirrors /api/internal/clients/status's no-op behavior).
    return NextResponse.json({ success: true, skipped: 'unknown client' });
  }

  const { matchStrategy, matchedSession, matchedMappedAd } = await matchIncomingMessage(
    client.id,
    waId,
    text,
  );

  const trackedMessage = await prisma.trackedMessage.create({
    data: {
      clientId: client.id,
      waId,
      text,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      phoneNumberId: typeof phoneNumberId === 'string' ? phoneNumberId : null,
      channel: typeof channel === 'string' ? channel : null,
      ctwaClid: typeof ctwaClid === 'string' ? ctwaClid : null,
      matchStrategy,
      matchedPixelSessionId: matchedSession?.id ?? null,
      matchedTrackingLinkId: matchedSession?.lastTrackingLinkId ?? null,
      matchedMappedAdId: matchedMappedAd?.id ?? null,
      kommoSyncStatus: matchedSession || matchedMappedAd ? 'PENDING' : 'SKIPPED',
    },
  });

  if (matchedSession || matchedMappedAd) {
    if (matchedSession) {
      await prisma.pixelSession.update({
        where: { id: matchedSession.id },
        data: { matchedAt: new Date() },
      });
    }

    await syncTrackedMessageToKommo(trackedMessage.id);
  }

  return NextResponse.json({ success: true, matchStrategy, trackedMessageId: trackedMessage.id });
}

// Tries, in order: a static per-ad code (AdMessageLink — Fase 2, Click-to-WhatsApp, no site visit
// at all) before a per-visitor PixelSession code (Fase 1, both invisible then visible), then falls
// back to the time-window heuristic (PixelSession only — there's no "recent click" signal to
// correlate a CTWA message against without a code, so AD_CODE has no fallback of its own).
async function matchIncomingMessage(
  clientId: string,
  waId: string,
  text: string,
): Promise<{
  matchStrategy: MatchStrategy;
  matchedSession: PixelSessionRow | null;
  matchedMappedAd: MappedAdRow | null;
}> {
  const invisibleCode = extractInvisibleCode(text);
  if (invisibleCode) {
    const adLink = await prisma.adMessageLink.findUnique({ where: { code: invisibleCode } });
    if (adLink && adLink.clientId === clientId) {
      const mappedAd = await prisma.mappedAd.findUnique({ where: { id: adLink.mappedAdId } });
      return { matchStrategy: 'AD_CODE', matchedSession: null, matchedMappedAd: mappedAd };
    }

    const session = await prisma.pixelSession.findUnique({ where: { sessionCode: invisibleCode } });
    if (session && session.clientId === clientId) {
      return { matchStrategy: 'CODE_INVISIBLE', matchedSession: session, matchedMappedAd: null };
    }
  }

  const visibleCode = extractVisibleCode(text);
  if (visibleCode) {
    const adLink = await prisma.adMessageLink.findUnique({ where: { code: visibleCode } });
    if (adLink && adLink.clientId === clientId) {
      const mappedAd = await prisma.mappedAd.findUnique({ where: { id: adLink.mappedAdId } });
      return { matchStrategy: 'AD_CODE', matchedSession: null, matchedMappedAd: mappedAd };
    }

    const session = await prisma.pixelSession.findUnique({ where: { sessionCode: visibleCode } });
    if (session && session.clientId === clientId) {
      return { matchStrategy: 'CODE_VISIBLE', matchedSession: session, matchedMappedAd: null };
    }
  }

  // The time-window guess below pairs this message with "whoever visited recently and hasn't
  // messaged yet". For a number that was already attributed, that is almost never true — it's a
  // follow-up in an ongoing conversation — and the guess would instead steal the visit of a
  // different person who scanned the QR code, leaving THEIR message with no origin.
  if (await hasRecentAttribution(clientId, waId)) {
    return { matchStrategy: 'UNMATCHED', matchedSession: null, matchedMappedAd: null };
  }

  const since = new Date(Date.now() - TIME_WINDOW_MINUTES * 60_000);
  // Sessions created by a redirect link (slug set) only take part in this heuristic when the
  // link's owner opted in — either by choosing the TIME_WINDOW strategy or the explicit fallback
  // toggle. Everything else (pixel sessions, visitors who haven't clicked a button yet) keeps
  // the original behavior.
  const fallback = await prisma.pixelSession.findFirst({
    where: {
      clientId,
      matchedAt: null,
      createdAt: { gte: since },
      OR: [
        { lastTrackingLinkId: null },
        { lastTrackingLink: { is: { slug: null } } },
        {
          lastTrackingLink: {
            is: { OR: [{ codingStrategy: 'TIME_WINDOW' }, { timeWindowFallback: true }] },
          },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (fallback) {
    return { matchStrategy: 'TIME_WINDOW', matchedSession: fallback, matchedMappedAd: null };
  }

  return { matchStrategy: 'UNMATCHED', matchedSession: null, matchedMappedAd: null };
}

async function hasRecentAttribution(clientId: string, waId: string): Promise<boolean> {
  const since = new Date(Date.now() - RETURNING_CONTACT_DAYS * 24 * 60 * 60 * 1000);
  const prior = await prisma.trackedMessage.findFirst({
    where: {
      clientId,
      waId: { in: brPhoneVariants(waId) },
      matchStrategy: { not: 'UNMATCHED' },
      receivedAt: { gte: since },
    },
    select: { id: true },
  });
  return prior !== null;
}
