import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKommoClientForClient } from '@/lib/kommo-auth';

// GET /api/kommo-pipeline-mapping/available-stages — lists the client's real Kommo pipelines and
// their statuses (id/name), resolved live — same "fetch live options from Kommo" pattern as
// /api/kommo-field-mapping/available-fields, but for pipeline stages instead of custom fields.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const kommoConn = await getKommoClientForClient(session.user.clientId);
  if (!kommoConn) {
    return NextResponse.json({ error: 'Kommo não configurado para este cliente' }, { status: 400 });
  }

  try {
    const res = await kommoConn.kommo.pipelines.list();
    const pipelines = (res._embedded?.pipelines ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      isMain: p.is_main,
      // sort included so the UI can pick "the first real stage" for its default-journey
      // suggestion — Kommo doesn't otherwise guarantee _embedded.statuses arrives pre-sorted.
      statuses: (p._embedded?.statuses ?? [])
        .map((s) => ({ id: s.id, name: s.name, sort: s.sort }))
        .sort((a, b) => a.sort - b.sort),
    }));
    return NextResponse.json({ pipelines });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar pipelines do Kommo' },
      { status: 502 },
    );
  }
}
