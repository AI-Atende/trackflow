import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processLeadStageChange } from '@/lib/leadJourney';

interface KommoWebhookLeadStatus {
  id: number;
  status_id: number;
  pipeline_id: number;
}

// Kommo webhooks are form-encoded with bracket-notation keys, e.g.
// "leads[status][0][id]", "leads[status][0][status_id]", "leads[status][0][pipeline_id]".
function parseStatusLeads(formData: FormData): KommoWebhookLeadStatus[] {
  const byIndex = new Map<number, Partial<KommoWebhookLeadStatus>>();
  for (const [key] of formData.entries()) {
    const match = key.match(/^leads\[status\]\[(\d+)\]\[(id|status_id|pipeline_id)\]$/);
    if (!match) continue;
    const index = Number(match[1]);
    const field = match[2] as keyof KommoWebhookLeadStatus;
    const value = formData.get(key);
    const entry = byIndex.get(index) ?? {};
    entry[field] = Number(value);
    byIndex.set(index, entry);
  }
  return Array.from(byIndex.values()).filter(
    (e): e is KommoWebhookLeadStatus =>
      e.id !== undefined && e.status_id !== undefined && e.pipeline_id !== undefined,
  );
}

// POST /api/webhooks/kommo/[clientId] — Kommo's inbound webhook (registered per client, event
// "status_lead", when the journey config is saved — see api/journey-stages). Kommo doesn't sign
// its webhooks, so this relies on the clientId path segment being an opaque cuid plus checking
// the payload's account subdomain against the one configured for this client, rather than a real
// signature. Always acks 200 — a bad/unrecognized payload isn't Kommo's problem to retry forever.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;

  const [client, integrationConfig] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.integrationConfig.findFirst({ where: { clientId, provider: 'KOMMO' } }),
  ]);
  if (!client) return NextResponse.json({ success: true });

  const configuredSubdomain = (integrationConfig?.config as { subdomain?: string } | null)
    ?.subdomain;

  const formData = await req.formData().catch(() => null);
  if (!formData || !configuredSubdomain) return NextResponse.json({ success: true });

  const accountSubdomain = formData.get('account[subdomain]')?.toString();
  if (accountSubdomain !== configuredSubdomain) return NextResponse.json({ success: true });

  const statusChanges = parseStatusLeads(formData);
  for (const change of statusChanges) {
    try {
      await processLeadStageChange({
        clientId,
        kommoLeadId: change.id,
        kommoPipelineId: change.pipeline_id,
        kommoStatusId: change.status_id,
        source: 'webhook',
      });
    } catch (err) {
      console.error(`[webhooks/kommo] client ${clientId} lead ${change.id} failed`, err);
    }
  }

  return NextResponse.json({ success: true });
}
