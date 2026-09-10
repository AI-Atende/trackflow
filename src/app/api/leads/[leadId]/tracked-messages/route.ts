import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    where: { clientId: session.user.clientId, waId: lead.waId },
    orderBy: { receivedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      text: true,
      receivedAt: true,
      matchStrategy: true,
      phoneNumberId: true,
      channel: true,
      matchedTrackingLink: { select: { label: true, waNumber: true } },
      matchedMappedAd: { select: { adName: true, campaignName: true, platform: true } },
      kommoLeadId: true,
      kommoSyncStatus: true,
      kommoSyncError: true,
      resolvedAdMatchConfidence: true,
    },
  });

  return NextResponse.json({ messages });
}
