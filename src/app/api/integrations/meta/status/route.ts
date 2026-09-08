import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: { metaUserAccessToken: true, metaAdAccounts: true },
  });

  const isConnected = !!client?.metaUserAccessToken;
  const activeAccount = client?.metaAdAccounts.find((a) => a.status === 'ACTIVE');

  return NextResponse.json({
    isConnected,
    accountName: activeAccount?.name || null,
    adAccountId: activeAccount?.adAccountId || null,
  });
}
