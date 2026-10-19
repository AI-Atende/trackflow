import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteLeads } from '@/lib/leadDeletion';

const MAX_IDS = 20000;

// POST /api/leads/bulk-delete — body: { ids: string[] } or { all: true }. Same semantics as
// DELETE /api/leads/[leadId] (see lib/leadDeletion.ts) applied to many leads at once. `all`
// resolves server-side to every lead of the caller's client, so "delete everything" works even
// when the page only has a filtered/paginated slice loaded. Always scoped to the session's
// client — ids belonging to another client are ignored, never deleted.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const clientId = session.user.clientId;

  const body = await req.json().catch(() => null);

  let ids: string[];
  if (body?.all === true) {
    const rows = await prisma.lead.findMany({ where: { clientId }, select: { id: true } });
    ids = rows.map((r) => r.id);
  } else if (
    Array.isArray(body?.ids) &&
    body.ids.length > 0 &&
    body.ids.every((id: unknown) => typeof id === 'string')
  ) {
    if (body.ids.length > MAX_IDS) {
      return NextResponse.json(
        { error: `Selecione no máximo ${MAX_IDS} leads por vez.` },
        { status: 400 },
      );
    }
    ids = [...new Set<string>(body.ids)];
  } else {
    return NextResponse.json({ error: 'Informe ids (lista) ou all: true' }, { status: 400 });
  }

  const deleted = await deleteLeads(clientId, ids);
  return NextResponse.json({ success: true, deleted });
}
