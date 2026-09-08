import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { metaGet } from '@/lib/meta/client';
import { MetaAdAccountOption } from '@/lib/meta/types';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: { metaUserAccessToken: true },
  });

  if (!client?.metaUserAccessToken) {
    return new NextResponse('Not connected to Meta', { status: 400 });
  }

  try {
    // Fetch Ad Accounts
    // We need fields: name, account_id, account_status
    const res = await metaGet<{ data: MetaAdAccountOption[] }>(
      '/me/adaccounts',
      client.metaUserAccessToken,
      {
        fields: 'name,account_id,account_status,currency,timezone_name,business',
        limit: 100,
      },
    );

    return NextResponse.json(res.data || []);
  } catch (error) {
    console.error('Error fetching ad accounts:', error);
    return new NextResponse('Failed to fetch accounts', { status: 500 });
  }
}
