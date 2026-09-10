import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKommoClientForClient } from '@/lib/kommo-auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const stages = await prisma.journeyStage.findMany({
    where: { clientId: session.user.clientId },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json({ stages });
}

// After saving stages, IntegrationConfig(provider: 'KOMMO').journeyMap is derived from the
// stages' labels (in order) — the dashboard funnel/reporting consumers keep reading that same
// field unchanged; only the *source* of the labels changes (picked live from Kommo, not typed).
async function syncJourneyMapLabels(clientId: string) {
  const stages = await prisma.journeyStage.findMany({
    where: { clientId },
    orderBy: { order: 'asc' },
  });
  const labels = stages.map((s) => s.label);

  const existing = await prisma.integrationConfig.findFirst({
    where: { clientId, provider: 'KOMMO' },
  });
  if (existing) {
    await prisma.integrationConfig.update({
      where: { id: existing.id },
      data: { journeyMap: labels },
    });
  }
}

// Registers this client's Kommo webhook (event "status_lead") pointing at our inbound route, if
// one doesn't already exist for this destination — so saving the journey config is the only step
// needed, no manual webhook setup in Kommo itself.
async function ensureKommoWebhookRegistered(clientId: string) {
  const kommoConn = await getKommoClientForClient(clientId);
  if (!kommoConn) return;

  const destination = `${process.env.NEXTAUTH_URL}/api/webhooks/kommo/${clientId}`;
  try {
    const existing = await kommoConn.kommo.webhooks.list({ filter_destination: destination });
    const alreadyRegistered = (existing._embedded?.webhooks ?? []).some(
      (w) => w.destination === destination,
    );
    if (!alreadyRegistered) {
      await kommoConn.kommo.webhooks.create({ destination, settings: ['status_lead'] });
    }
  } catch (err) {
    // Non-fatal — the journey still works via manual/API triggers even if the webhook couldn't
    // be registered (e.g. missing webhooks scope); log it so it's visible in server logs.
    console.error(`[journey-stages] failed to register Kommo webhook for client ${clientId}`, err);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const clientId = session.user.clientId;

  const body = await req.json().catch(() => null);
  const stages = body?.stages;
  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: 'stages deve ser um array' }, { status: 400 });
  }

  // The journey always has exactly one FIRST ("Lead criado") and one LAST ("Compra") bookend —
  // enforced here too, not just in the UI, since this endpoint is the actual source of truth.
  const firstCount = stages.filter((s) => s?.position === 'FIRST').length;
  const lastCount = stages.filter((s) => s?.position === 'LAST').length;
  if (firstCount !== 1 || lastCount !== 1) {
    return NextResponse.json(
      { error: 'A jornada precisa de exatamente uma etapa inicial e uma final' },
      { status: 400 },
    );
  }

  for (const stage of stages) {
    const {
      id,
      label,
      position,
      order,
      kommoPipelineId,
      kommoStatusId,
      metaEventName,
      googleConversionActionId,
    } = stage ?? {};
    if (!label || kommoPipelineId == null || kommoStatusId == null) {
      return NextResponse.json(
        { error: 'label, kommoPipelineId e kommoStatusId são obrigatórios em cada etapa' },
        { status: 400 },
      );
    }

    const data = {
      label,
      position: position === 'FIRST' || position === 'LAST' ? position : null,
      order: order ?? 0,
      kommoPipelineId: Number(kommoPipelineId),
      kommoStatusId: Number(kommoStatusId),
      metaEventName: metaEventName || null,
      googleConversionActionId: googleConversionActionId || null,
    };

    if (id) {
      await prisma.journeyStage.updateMany({ where: { id, clientId }, data });
    } else {
      await prisma.journeyStage.create({ data: { clientId, ...data } });
    }
  }

  await syncJourneyMapLabels(clientId);
  await ensureKommoWebhookRegistered(clientId);

  const updated = await prisma.journeyStage.findMany({
    where: { clientId },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json({ stages: updated });
}
