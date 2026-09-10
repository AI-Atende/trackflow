import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/integrations/google/settings — MCC id + consent, separate from account selection
// (select/route.ts). managerId is passed as login_customer_id on every Google Ads API call this
// app makes (ad-catalog sync, conversion actions, conversion upload) once saved here.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { managerId, consentGranted } = body ?? {};

  const accounts = await prisma.googleAdAccount.findMany({
    where: { clientId: session.user.clientId },
  });
  const account = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  if (!account) {
    return NextResponse.json({ error: 'Nenhuma conta Google Ads conectada' }, { status: 400 });
  }

  await prisma.googleAdAccount.update({
    where: { id: account.id },
    data: {
      managerId: managerId ? String(managerId).replace(/-/g, '') : null,
      googleAdsConsentGranted: consentGranted ?? true,
    },
  });

  return NextResponse.json({ success: true });
}
