import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@generated/prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildRedirectUrl,
  ensureClientShortKey,
  isValidSlug,
  normalizeSlug,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
} from '@/lib/redirectLinks';

const CODING_STRATEGIES = ['INVISIBLE', 'VISIBLE_CODE', 'TIME_WINDOW'] as const;
type CodingStrategyValue = (typeof CODING_STRATEGIES)[number];

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const clientId = session.user.clientId;

  const [links, client, visits, conversations] = await Promise.all([
    prisma.trackingLink.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.findUnique({ where: { id: clientId }, select: { shortKey: true } }),
    // Visits = PixelSessions whose last link was this one; conversations = those that went on to
    // actually consume a message (matchedAt). Per-link counts for redirect links' stats columns.
    prisma.pixelSession.groupBy({
      by: ['lastTrackingLinkId'],
      where: { clientId, lastTrackingLinkId: { not: null } },
      _count: { _all: true },
    }),
    prisma.pixelSession.groupBy({
      by: ['lastTrackingLinkId'],
      where: { clientId, lastTrackingLinkId: { not: null }, matchedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const visitsByLink = new Map(visits.map((r) => [r.lastTrackingLinkId, r._count._all]));
  const conversationsByLink = new Map(
    conversations.map((r) => [r.lastTrackingLinkId, r._count._all]),
  );
  const fallbackOrigin = req.nextUrl.origin;

  return NextResponse.json({
    links: links.map((link) => ({
      ...link,
      redirectUrl:
        link.slug && client?.shortKey
          ? buildRedirectUrl(client.shortKey, link.slug, fallbackOrigin)
          : null,
      visits: visitsByLink.get(link.id) ?? 0,
      conversations: conversationsByLink.get(link.id) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const clientId = session.user.clientId;

  const body = await req.json().catch(() => null);
  const { label, waNumber, messageTemplate, codingStrategy, slug, timeWindowFallback } = body ?? {};
  if (!label || !waNumber || !messageTemplate) {
    return NextResponse.json(
      { error: 'label, waNumber e messageTemplate são obrigatórios' },
      { status: 400 },
    );
  }

  const strategy: CodingStrategyValue = codingStrategy ?? 'VISIBLE_CODE';
  if (!CODING_STRATEGIES.includes(strategy)) {
    return NextResponse.json({ error: 'codingStrategy inválida' }, { status: 400 });
  }

  // Redirect link (public URL) only when a slug was sent; otherwise a plain pixel-button link.
  let normalizedSlug: string | null = null;
  if (slug !== undefined && slug !== null && String(slug).trim() !== '') {
    normalizedSlug = normalizeSlug(String(slug));
    if (!isValidSlug(normalizedSlug)) {
      return NextResponse.json(
        {
          error: `O endereço deve ter de ${SLUG_MIN_LENGTH} a ${SLUG_MAX_LENGTH} caracteres, só com letras, números e hífen.`,
        },
        { status: 400 },
      );
    }
  }

  try {
    const link = await prisma.trackingLink.create({
      data: {
        clientId,
        label,
        waNumber: String(waNumber).replace(/\D/g, '') || waNumber,
        messageTemplate,
        codingStrategy: strategy,
        slug: normalizedSlug,
        utmSource: optionalText(body.utmSource),
        utmMedium: optionalText(body.utmMedium),
        utmCampaign: optionalText(body.utmCampaign),
        utmContent: optionalText(body.utmContent),
        utmTerm: optionalText(body.utmTerm),
        timeWindowFallback: normalizedSlug ? timeWindowFallback === true : false,
      },
    });

    const redirectUrl = normalizedSlug
      ? buildRedirectUrl(await ensureClientShortKey(clientId), normalizedSlug, req.nextUrl.origin)
      : null;

    return NextResponse.json(
      { ...link, redirectUrl, visits: 0, conversations: 0 },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Você já tem um link com esse endereço. Escolha outro.' },
        { status: 409 },
      );
    }
    throw err;
  }
}
