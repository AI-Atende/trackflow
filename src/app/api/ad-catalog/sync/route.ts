import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncAdCatalogForClient } from '@/lib/adCatalogSync';

// POST /api/ad-catalog/sync — "Sincronizar agora" button. Pulls the whole account (no date
// filter) for every connected platform (Meta and/or Google) and upserts into MappedAd.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const result = await syncAdCatalogForClient(session.user.clientId);

  if (!result.connected) {
    return NextResponse.json(
      { error: 'Nenhuma conta de anúncios (Meta ou Google) conectada' },
      { status: 400 },
    );
  }

  // Partial failure (one platform synced, the other errored) still comes back 200 — the synced
  // count from whichever platform worked is real, `errors` just flags what didn't.
  return NextResponse.json({ synced: result.synced, errors: result.errors });
}
