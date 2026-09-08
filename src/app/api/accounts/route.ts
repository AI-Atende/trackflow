import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    // 1. Get own account
    const ownAccount = await prisma.client.findUnique({
      where: { id: session.user.clientId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        metaAdAccounts: {
          select: { adAccountId: true, name: true },
        },
        integrations: {
          where: { isActive: true },
          select: { provider: true, config: true, journeyMap: true },
        },
      },
    });

    // 2. Get shared accounts (where user is guest and status is ACCEPTED)
    const sharedInvites = await prisma.accountInvite.findMany({
      where: {
        guestId: session.user.clientId,
        status: 'ACCEPTED',
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            metaAdAccounts: {
              select: { adAccountId: true, name: true },
            },
            integrations: {
              where: { isActive: true },
              select: { provider: true, config: true, journeyMap: true },
            },
          },
        },
      },
    });

    const sharedAccounts = sharedInvites.map((invite) => invite.owner);

    const accounts = [ownAccount, ...sharedAccounts].filter(Boolean);

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Erro ao buscar contas:', error);
    return NextResponse.json({ error: 'Erro ao buscar contas' }, { status: 500 });
  }
}
