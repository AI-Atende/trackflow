import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKommoClientForClient } from '@/lib/kommo-auth';
import { processLeadStageChange } from '@/lib/leadJourney';

// POST /api/leads/[leadId]/stage — manual stage change from the /leads UI. Kommo stays the
// system of record: this pushes the move to Kommo first (kommo.leads.updateOne), then processes
// it locally the same way the webhook would — processLeadStageChange's idempotency guard means
// the webhook Kommo fires back for this same change (if configured) is a harmless no-op re-trigger.
export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { leadId } = await params;
  const body = await req.json().catch(() => null);
  const journeyStageId = body?.journeyStageId;
  if (!journeyStageId) {
    return NextResponse.json({ error: 'journeyStageId é obrigatório' }, { status: 400 });
  }

  const [lead, journeyStage] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.journeyStage.findUnique({ where: { id: journeyStageId } }),
  ]);
  if (!lead || lead.clientId !== session.user.clientId) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
  }
  if (!journeyStage || journeyStage.clientId !== session.user.clientId) {
    return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 });
  }

  const kommoConn = await getKommoClientForClient(session.user.clientId);
  if (!kommoConn) {
    return NextResponse.json({ error: 'Kommo não configurado' }, { status: 400 });
  }

  try {
    await kommoConn.kommo.leads.updateOne(lead.kommoLeadId, {
      status_id: journeyStage.kommoStatusId,
      pipeline_id: journeyStage.kommoPipelineId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao mover o lead no Kommo' },
      { status: 502 },
    );
  }

  await processLeadStageChange({
    clientId: session.user.clientId,
    kommoLeadId: lead.kommoLeadId,
    kommoPipelineId: journeyStage.kommoPipelineId,
    kommoStatusId: journeyStage.kommoStatusId,
    source: 'manual',
  });

  return NextResponse.json({ success: true });
}
