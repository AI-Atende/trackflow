import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    include: { googleAdAccounts: true },
  });

  if (!client) {
    return new NextResponse('Client not found', { status: 404 });
  }

  const isConnected = !!client.googleUserRefreshToken;
  const activeAccount = client.googleAdAccounts.find((a) => a.status === 'ACTIVE');

  return NextResponse.json({
    isConnected,
    accountName: activeAccount?.name || null,
    customerId: activeAccount?.customerId || null,
  });
}

export async function DELETE(_request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Disconnect: Remove tokens and deactivate accounts
  await prisma.client.update({
    where: { id: session.user.clientId },
    data: {
      googleUserAccessToken: null,
      googleUserRefreshToken: null,
      googleUserTokenExpiry: null,
    },
  });

  await prisma.googleAdAccount.updateMany({
    where: { clientId: session.user.clientId },
    data: { status: 'DISCONNECTED' },
  });

  return NextResponse.json({ success: true });
}
