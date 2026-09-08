import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKommoClient } from '@/lib/kommo-auth';

// GET /api/kommo-field-mapping/available-fields — lists the client's real Kommo lead custom
// fields (id/name/code), resolved live, so the mapping UI can offer a dropdown instead of
// asking the client to type in raw field IDs by hand.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const [client, integrationConfig] = await Promise.all([
    prisma.client.findUnique({ where: { id: session.user.clientId } }),
    prisma.integrationConfig.findFirst({
      where: { clientId: session.user.clientId, provider: 'KOMMO' },
    }),
  ]);

  const subdomain = (integrationConfig?.config as { subdomain?: string } | null)?.subdomain;
  if (!client?.portalClientId || !subdomain) {
    return NextResponse.json({ error: 'Kommo não configurado para este cliente' }, { status: 400 });
  }

  try {
    const kommo = await getKommoClient(subdomain, client.portalClientId);
    const res = await kommo.customFields.listEntity('leads');
    const fields = (res._embedded?.custom_fields ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code ?? null,
    }));
    return NextResponse.json({ fields });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar campos do Kommo' },
      { status: 502 },
    );
  }
}
