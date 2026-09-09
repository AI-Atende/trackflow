import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncMetaAdCatalog } from '@/lib/adCatalogSync';

// POST /api/ad-catalog/sync — "Sincronizar agora" button. Pulls the whole account (no date
// filter, no Google yet — see plan doc) and upserts into MappedAd.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const result = await syncMetaAdCatalog(session.user.clientId);
    if (!result) {
      return NextResponse.json(
        { error: 'Nenhuma conta de anúncios Meta conectada' },
        { status: 400 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao sincronizar catálogo' },
      { status: 502 },
    );
  }
}
