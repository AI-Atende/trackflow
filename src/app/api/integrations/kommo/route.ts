import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const clientId = session.user.clientId;
  const body = await req.json();
  // subdomain is NOT accepted here anymore — it's mirrored from the portal's KommoConfig on
  // every SSO login (see lib/auth.ts's portal-sso provider), not entered in TrackFlow.
  const { journeyMap, isActive } = body;

  try {
    // Verificar se já existe config
    const existingConfig = await prisma.integrationConfig.findFirst({
      where: { clientId, provider: 'KOMMO' },
    });

    if (existingConfig) {
      const updated = await prisma.integrationConfig.update({
        where: { id: existingConfig.id },
        data: {
          isActive,
          journeyMap,
        },
      });
      return NextResponse.json(updated);
    } else {
      const created = await prisma.integrationConfig.create({
        data: {
          clientId,
          provider: 'KOMMO',
          isActive,
          journeyMap,
        },
      });
      return NextResponse.json(created);
    }
  } catch (error) {
    console.error('Erro ao salvar configuração Kommo:', error);
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
  }
}

import { verifyAccountAccess } from '@/lib/access-control';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetAccountId = searchParams.get('targetAccountId') || session.user.clientId;

  try {
    const hasAccess = await verifyAccountAccess(session.user.clientId, targetAccountId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const config = await prisma.integrationConfig.findFirst({
      where: { clientId: targetAccountId, provider: 'KOMMO' },
    });

    return NextResponse.json(config || { isActive: false, config: {}, journeyMap: [] });
  } catch (error) {
    console.error('Erro ao buscar configuração Kommo:', error);
    return NextResponse.json({ error: 'Erro ao buscar configuração' }, { status: 500 });
  }
}
