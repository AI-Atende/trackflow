import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { customerId, name } = body;

  if (!customerId) {
    return new NextResponse('Missing customerId', { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: { googleUserRefreshToken: true },
  });

  if (!client?.googleUserRefreshToken) {
    return new NextResponse('Not connected to Google Ads', { status: 400 });
  }

  try {
    // Upsert GoogleAdAccount

    // 1. Deactivate other Google accounts for this client (if we only allow one active)
    await prisma.googleAdAccount.updateMany({
      where: {
        clientId: session.user.clientId,
        customerId: { not: customerId },
      },
      data: { status: 'DISCONNECTED' },
    });

    // Check if exists
    const existing = await prisma.googleAdAccount.findFirst({
      where: {
        clientId: session.user.clientId,
        customerId: customerId,
      },
    });

    if (existing) {
      await prisma.googleAdAccount.update({
        where: { id: existing.id },
        data: {
          refreshToken: client.googleUserRefreshToken,
          status: 'ACTIVE',
          name: name || existing.name,
        },
      });
    } else {
      await prisma.googleAdAccount.create({
        data: {
          clientId: session.user.clientId,
          customerId: customerId,
          refreshToken: client.googleUserRefreshToken,
          status: 'ACTIVE',
          name: name || `Account ${customerId}`,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error selecting Google ad account:', error);
    return new NextResponse('Failed to select account', { status: 500 });
  }
}
