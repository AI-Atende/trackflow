import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processLeadStageChange } from '@/lib/leadJourney';

// POST /api/internal/leads/stage — for other systems (e.g. the portal) to report a Kommo lead's
// stage change without going through Kommo's own webhook. Same shared x-api-key auth as
// /api/internal/messages/received. Identifies the lead/stage by the same Kommo pipeline/status ids
// JourneyStage is configured with — callers are expected to already know these (or look them up
// via GET /api/kommo-pipeline-mapping/available-stages, same as the journey config UI does).
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!process.env.TRACKFLOW_API_KEY || apiKey !== process.env.TRACKFLOW_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { portalClientId, kommoLeadId, kommoPipelineId, kommoStatusId } = body ?? {};
  if (!portalClientId || !kommoLeadId || !kommoPipelineId || !kommoStatusId) {
    return NextResponse.json(
      { error: 'portalClientId, kommoLeadId, kommoPipelineId e kommoStatusId são obrigatórios' },
      { status: 400 },
    );
  }

  const client = await prisma.client.findUnique({ where: { portalClientId } });
  if (!client) {
    return NextResponse.json({ success: true, skipped: 'unknown client' });
  }

  await processLeadStageChange({
    clientId: client.id,
    kommoLeadId: Number(kommoLeadId),
    kommoPipelineId: Number(kommoPipelineId),
    kommoStatusId: Number(kommoStatusId),
    source: 'api',
  });

  return NextResponse.json({ success: true });
}
