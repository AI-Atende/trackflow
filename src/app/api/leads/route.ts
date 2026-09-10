import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/leads — the client's known leads (mirrored from Kommo by processLeadStageChange),
// with enough joined data for the /leads page: current stage, attributed ad, and conversion
// event history.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const [leads, stages] = await Promise.all([
    prisma.lead.findMany({
      where: { clientId: session.user.clientId },
      include: {
        currentJourneyStage: { select: { id: true, label: true, order: true } },
        matchedMappedAd: {
          select: { id: true, adName: true, campaignName: true, platform: true },
        },
        conversionEventLogs: {
          select: {
            id: true,
            platform: true,
            eventName: true,
            status: true,
            errorMessage: true,
            sentAt: true,
            createdAt: true,
            journeyStage: { select: { label: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.journeyStage.findMany({
      where: { clientId: session.user.clientId },
      orderBy: { order: 'asc' },
      select: { id: true, label: true, order: true },
    }),
  ]);

  return NextResponse.json({ leads, stages });
}
