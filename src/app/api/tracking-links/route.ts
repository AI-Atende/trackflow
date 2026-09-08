import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const links = await prisma.trackingLink.findMany({
    where: { clientId: session.user.clientId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { label, waNumber, messageTemplate, codingStrategy } = body ?? {};
  if (!label || !waNumber || !messageTemplate) {
    return NextResponse.json(
      { error: 'label, waNumber e messageTemplate são obrigatórios' },
      { status: 400 },
    );
  }

  const link = await prisma.trackingLink.create({
    data: {
      clientId: session.user.clientId,
      label,
      waNumber,
      messageTemplate,
      codingStrategy: codingStrategy ?? 'INVISIBLE',
    },
  });

  return NextResponse.json(link, { status: 201 });
}
