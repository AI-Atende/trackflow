import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { attemptSendConversionEvent } from '@/lib/leadJourney';

// POST /api/leads/[leadId]/conversion-events/[logId]/retry — manual re-send of one FAILED (or
// stuck PENDING) ConversionEventLog row from the /leads UI. Unlike the automatic cron sweep
// (retryPendingConversionEvents), this ignores MAX_RETRY_ATTEMPTS — a human clicking "tentar
// novamente" after fixing a config issue (e.g. an expired Meta token) should always be allowed
// to try again. Never re-sends an already-SENT event (that already tagged the Kommo lead).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string; logId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { leadId, logId } = await params;
  const log = await prisma.conversionEventLog.findUnique({
    where: { id: logId },
    include: { lead: true, journeyStage: true },
  });
  if (!log || log.clientId !== session.user.clientId || log.leadId !== leadId) {
    return NextResponse.json({ error: 'Evento de conversão não encontrado' }, { status: 404 });
  }
  if (log.status === 'SENT') {
    return NextResponse.json({ error: 'Esse evento já foi enviado com sucesso' }, { status: 409 });
  }

  await attemptSendConversionEvent(
    log.id,
    session.user.clientId,
    log.lead,
    log.platform,
    log.eventName,
    log.journeyStage.label,
  );

  const updated = await prisma.conversionEventLog.findUnique({ where: { id: logId } });
  return NextResponse.json({ log: updated });
}
