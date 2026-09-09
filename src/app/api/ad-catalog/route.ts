import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/ad-catalog — the client's mapped ads (campaign/adset/ad), most recently synced first.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const ads = await prisma.mappedAd.findMany({
    where: { clientId: session.user.clientId },
    orderBy: [{ campaignName: 'asc' }, { adsetName: 'asc' }, { adName: 'asc' }],
  });

  return NextResponse.json({ ads });
}
