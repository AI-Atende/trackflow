import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyAccountAccess } from '@/lib/access-control';
import { fetchMetaCampaigns } from '@/services/metaService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ adAccountId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { adAccountId } = await params;

  const { searchParams } = new URL(req.url);
  const since = searchParams.get('since') || '2024-01-01';
  const until = searchParams.get('until') || '2024-01-31';

  // Find the ad account first to identify the owner
  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { adAccountId },
  });

  if (!metaAccount) {
    return NextResponse.json({ error: 'Conta de anúncios não encontrada.' }, { status: 404 });
  }

  // Verify access to the owner of the ad account
  const hasAccess = await verifyAccountAccess(session.user.clientId, metaAccount.clientId);

  if (!hasAccess) {
    return NextResponse.json({ error: 'Acesso negado a esta conta de anúncios.' }, { status: 403 });
  }

  if (metaAccount.status.toLowerCase() !== 'active') {
    return NextResponse.json({ error: 'A conta de anúncios não está ativa.' }, { status: 400 });
  }

  // Use the service to fetch campaigns with consistent logic (including Reach/Results and Journey Map)
  const campaigns = await fetchMetaCampaigns(metaAccount.adAccountId, since, until);

  return NextResponse.json({
    campaigns,
  });
}
