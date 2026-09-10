import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { importExistingLeadsFromKommo } from '@/lib/leadJourney';

// POST /api/leads/import — one-time backfill of Kommo leads already sitting in a mapped
// pipeline/status, so the journey reflects reality without waiting for each one to move stage
// again. Deliberately does not fire conversion events (see importExistingLeadsFromKommo).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const result = await importExistingLeadsFromKommo(session.user.clientId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao importar leads do Kommo' },
      { status: 502 },
    );
  }
}
