import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const CODING_STRATEGIES = ['INVISIBLE', 'VISIBLE_CODE', 'TIME_WINDOW'];

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// PATCH /api/tracking-links/[id] — partial update of everything except the slug. The slug is the
// one thing baked into already-printed/published QR codes and shared URLs, so changing it would
// silently break them; everything else is read from the database on each visit (see
// app/r/[clientKey]/[slug]/route.ts), so an edit takes effect for the next visitor with no
// effect on visits already recorded — each PixelSession keeps the UTMs it was created with, and
// matching an incoming message only looks at the code, never at the template text.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const link = await prisma.trackingLink.findFirst({
    where: { id, clientId: session.user.clientId },
  });
  if (!link) {
    return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  if ('slug' in body && body.slug !== link.slug) {
    return NextResponse.json(
      {
        error:
          'O endereço do link não pode ser alterado — QR codes já impressos deixariam de funcionar.',
      },
      { status: 400 },
    );
  }

  const data: Record<string, string | boolean | null> = {};

  for (const field of ['label', 'messageTemplate'] as const) {
    if (field in body) {
      if (typeof body[field] !== 'string' || !body[field].trim()) {
        return NextResponse.json({ error: `${field} não pode ficar vazio` }, { status: 400 });
      }
      data[field] = body[field].trim();
    }
  }
  if ('waNumber' in body) {
    const digits = String(body.waNumber ?? '').replace(/\D/g, '');
    if (!digits) {
      return NextResponse.json({ error: 'waNumber inválido' }, { status: 400 });
    }
    data.waNumber = digits;
  }
  if ('codingStrategy' in body) {
    if (!CODING_STRATEGIES.includes(body.codingStrategy)) {
      return NextResponse.json({ error: 'codingStrategy inválida' }, { status: 400 });
    }
    data.codingStrategy = body.codingStrategy;
  }
  for (const field of ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm'] as const) {
    if (field in body) data[field] = optionalText(body[field]);
  }
  // Only meaningful on redirect links (see TrackingLink.timeWindowFallback).
  if ('timeWindowFallback' in body && link.slug) {
    data.timeWindowFallback = body.timeWindowFallback === true;
  }

  const updated = await prisma.trackingLink.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  await prisma.trackingLink.deleteMany({ where: { id, clientId: session.user.clientId } });

  return NextResponse.json({ success: true });
}
