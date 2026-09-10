import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// pixelId/capiAccessToken live on MetaAdAccount (not IntegrationConfig) — they're specific to the
// connected ad account's Conversions API setup, pasted by the client from Meta's Events Manager
// (no OAuth scope this app already has can discover them automatically).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const accounts = await prisma.metaAdAccount.findMany({
    where: { clientId: session.user.clientId },
  });
  const account = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  return NextResponse.json({
    pixelId: account?.pixelId ?? null,
    capiAccessToken: account?.capiAccessToken ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { pixelId, capiAccessToken } = body ?? {};

  const accounts = await prisma.metaAdAccount.findMany({
    where: { clientId: session.user.clientId },
  });
  const account = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  if (!account) {
    return NextResponse.json(
      { error: 'Nenhuma conta de anúncios Meta conectada' },
      { status: 400 },
    );
  }

  await prisma.metaAdAccount.update({
    where: { id: account.id },
    data: { pixelId: pixelId || null, capiAccessToken: capiAccessToken || null },
  });

  return NextResponse.json({ success: true });
}
