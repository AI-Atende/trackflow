import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(_request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const account = await prisma.googleAdAccount.findFirst({
    where: {
      clientId: session.user.clientId,
      status: 'ACTIVE',
    },
  });

  if (!account) {
    return NextResponse.json({ isConnected: false });
  }

  return NextResponse.json({
    isConnected: true,
    account: {
      customerId: account.customerId,
      name: account.name,
    },
  });
}

export async function DELETE(_request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.googleAdAccount.updateMany({
    where: { clientId: session.user.clientId },
    data: { status: 'DISCONNECTED' },
  });

  return NextResponse.json({ success: true });
}
