import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. Remove tokens from Client
    await prisma.client.update({
      where: { id: session.user.clientId },
      data: {
        metaUserAccessToken: null,
        metaUserTokenExpiry: null,
      },
    });

    // 2. Deactivate Integration Config
    const config = await prisma.integrationConfig.findFirst({
      where: { clientId: session.user.clientId, provider: 'META' },
    });

    if (config) {
      await prisma.integrationConfig.update({
        where: { id: config.id },
        data: { isActive: false },
      });
    }

    // 3. Optional: Deactivate Ad Accounts?
    // For now, we keep them but they won't sync without a token.
    // We could set status = 'DISCONNECTED' if we wanted.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Meta:', error);
    return new NextResponse('Failed to disconnect', { status: 500 });
  }
}
