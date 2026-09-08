import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/internal/clients/status — called by the aiatende-portal whenever an admin
// activates/deactivates the TrackFlow integration for a client. Authenticated with a
// shared server-to-server key (not a user session), mirrored by TRACKFLOW_API_KEY on the
// portal side. Silently no-ops if the client hasn't logged into TrackFlow yet (no row with
// this portalClientId) — there's nothing to (de)activate there.
export async function PATCH(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!process.env.TRACKFLOW_API_KEY || apiKey !== process.env.TRACKFLOW_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { portalClientId, isActive } = await req.json();

    if (!portalClientId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'portalClientId e isActive são obrigatórios' },
        { status: 400 },
      );
    }

    const result = await prisma.client.updateMany({
      where: { portalClientId },
      data: { isActive },
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('Erro ao atualizar status do cliente:', error);
    return NextResponse.json({ error: 'Erro ao atualizar status do cliente' }, { status: 500 });
  }
}
