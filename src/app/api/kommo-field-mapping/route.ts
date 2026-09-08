import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const mapping = await prisma.kommoFieldMapping.findUnique({
    where: { clientId: session.user.clientId },
  });
  return NextResponse.json(mapping ?? {});
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  const data = {
    utmSourceFieldId: body.utmSourceFieldId ?? null,
    utmMediumFieldId: body.utmMediumFieldId ?? null,
    utmCampaignFieldId: body.utmCampaignFieldId ?? null,
    utmContentFieldId: body.utmContentFieldId ?? null,
    utmTermFieldId: body.utmTermFieldId ?? null,
    fbclidFieldId: body.fbclidFieldId ?? null,
    gclidFieldId: body.gclidFieldId ?? null,
  };

  const mapping = await prisma.kommoFieldMapping.upsert({
    where: { clientId: session.user.clientId },
    create: { clientId: session.user.clientId, ...data },
    update: data,
  });

  return NextResponse.json(mapping);
}
