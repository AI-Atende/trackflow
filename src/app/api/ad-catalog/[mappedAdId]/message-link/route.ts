import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateShortCode, embedInvisibleCode, embedVisibleCode } from '@/lib/tracking-codes';

// POST /api/ad-catalog/[mappedAdId]/message-link — creates or replaces (upsert on mappedAdId)
// the static Click-to-WhatsApp tracked message for this ad (Fase 2 — "anúncio → WhatsApp
// direto"). Meta only: a CTWA pre-filled message is a Meta ad concept, no Google Ads equivalent.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mappedAdId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { mappedAdId } = await params;
  const body = await req.json().catch(() => null);
  const { waNumber, messageTemplate, codingStrategy } = body ?? {};
  if (!waNumber || !messageTemplate) {
    return NextResponse.json(
      { error: 'waNumber e messageTemplate são obrigatórios' },
      { status: 400 },
    );
  }
  if (codingStrategy !== 'INVISIBLE' && codingStrategy !== 'VISIBLE_CODE') {
    return NextResponse.json(
      { error: 'codingStrategy deve ser INVISIBLE ou VISIBLE_CODE' },
      { status: 400 },
    );
  }

  const mappedAd = await prisma.mappedAd.findUnique({ where: { id: mappedAdId } });
  if (!mappedAd || mappedAd.clientId !== session.user.clientId) {
    return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 });
  }
  if (mappedAd.platform !== 'META') {
    return NextResponse.json(
      { error: 'Mensagem rastreada para Click-to-WhatsApp só existe para anúncios Meta' },
      { status: 400 },
    );
  }

  // A fresh code every time (including on regenerate) — the old one simply stops matching future
  // messages once this upsert commits; TrackedMessages that already matched via it keep pointing
  // at this same MappedAd via matchedMappedAdId, so past attribution isn't affected.
  const code = generateShortCode();
  const finalMessage =
    codingStrategy === 'INVISIBLE'
      ? embedInvisibleCode(messageTemplate, code)
      : embedVisibleCode(messageTemplate, code);

  const link = await prisma.adMessageLink.upsert({
    where: { mappedAdId },
    create: {
      clientId: session.user.clientId,
      mappedAdId,
      code,
      waNumber,
      messageTemplate,
      codingStrategy,
      finalMessage,
    },
    update: {
      code,
      waNumber,
      messageTemplate,
      codingStrategy,
      finalMessage,
    },
  });

  return NextResponse.json(link);
}
