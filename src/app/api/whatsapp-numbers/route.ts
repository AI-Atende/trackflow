import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchPortalWhatsAppNumbers } from '@/lib/portal-client';

// GET /api/whatsapp-numbers — numbers already registered in the client's messaging platform
// connection on the portal, offered as picker options when creating a TrackingLink.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const client = await prisma.client.findUnique({ where: { id: session.user.clientId } });
  if (!client?.portalClientId) {
    return NextResponse.json({ numbers: [] });
  }

  const numbers = await fetchPortalWhatsAppNumbers(client.portalClientId);
  return NextResponse.json({ numbers });
}
