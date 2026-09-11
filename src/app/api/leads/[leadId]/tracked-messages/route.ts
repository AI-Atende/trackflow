import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { brPhoneVariants } from '@/lib/phone';

// GET /api/leads/[leadId]/tracked-messages — the inbound WhatsApp messages TrackFlow used to
// attribute this lead (see matchIncomingMessage in api/internal/messages/received/route.ts),
// with what each one matched against. Lets the /leads UI show *why* a lead has (or lacks)
// attribution data instead of leaving it a black box — e.g. a lead with no fbclid/gclid because
// its messages never matched anything (matchStrategy UNMATCHED) looks very different from one
// where the match/sync itself failed.
export async function GET(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.clientId !== session.user.clientId) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
  }
  if (!lead.waId) {
    return NextResponse.json({ messages: [] });
  }

  const messages = await prisma.trackedMessage.findMany({
    where: { clientId: session.user.clientId, waId: { in: brPhoneVariants(lead.waId) } },
    orderBy: { receivedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      text: true,
      receivedAt: true,
      matchStrategy: true,
      phoneNumberId: true,
      channel: true,
      matchedPixelSessionId: true,
      matchedTrackingLink: { select: { label: true, waNumber: true } },
      matchedMappedAd: { select: { adName: true, campaignName: true, platform: true } },
      kommoLeadId: true,
      kommoSyncStatus: true,
      kommoSyncError: true,
      resolvedAdMatchConfidence: true,
    },
  });

  // matchedPixelSessionId isn't a formal Prisma relation (no @relation declared on it — unlike
  // matchedTrackingLink/matchedMappedAd), so the UTM values it points to never came back from the
  // select above. That's the actual reason UTMs only ever showed up in Kommo, never in this
  // panel: syncToKommo (api/internal/messages/received) writes them to Kommo's custom fields
  // directly from the PixelSession, but nothing here was reading that same row back.
  const sessionIds = [
    ...new Set(
      messages.map((m) => m.matchedPixelSessionId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const sessions = sessionIds.length
    ? await prisma.pixelSession.findMany({
        where: { id: { in: sessionIds } },
        select: {
          id: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
          fbclid: true,
          gclid: true,
          gbraid: true,
          wbraid: true,
          landingUrl: true,
        },
      })
    : [];
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const messagesWithSession = messages.map(({ matchedPixelSessionId, ...msg }) => ({
    ...msg,
    matchedPixelSession: matchedPixelSessionId
      ? (sessionById.get(matchedPixelSessionId) ?? null)
      : null,
  }));

  return NextResponse.json({ messages: messagesWithSession });
}
