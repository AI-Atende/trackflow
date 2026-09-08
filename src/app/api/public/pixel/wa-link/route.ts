import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { embedInvisibleCode, embedVisibleCode } from '@/lib/tracking-codes';

// POST /api/public/pixel/wa-link — called by the pixel script right before a visitor clicks a
// WhatsApp button on the site. Public/unauthenticated. Builds the actual wa.me link for THIS
// visitor by stitching their PixelSession's own code into the TrackingLink's message template
// (per its codingStrategy) — the embedded code varies per visitor even though the button/link
// config is shared. Also records which link this session used (lastTrackingLinkId), both for
// reporting and as the TIME_WINDOW fallback's best guess at receive-time.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { linkId, sessionCode } = body ?? {};
  if (!linkId || !sessionCode) {
    return NextResponse.json({ error: 'linkId and sessionCode are required' }, { status: 400 });
  }

  const link = await prisma.trackingLink.findUnique({ where: { id: linkId } });
  if (!link) {
    return NextResponse.json({ error: 'Unknown tracking link' }, { status: 404 });
  }

  const session = await prisma.pixelSession.findUnique({ where: { sessionCode } });
  if (!session || session.clientId !== link.clientId) {
    return NextResponse.json({ error: 'Unknown or mismatched session' }, { status: 404 });
  }

  let finalMessage = link.messageTemplate;
  if (link.codingStrategy === 'INVISIBLE') {
    finalMessage = embedInvisibleCode(link.messageTemplate, sessionCode);
  } else if (link.codingStrategy === 'VISIBLE_CODE') {
    finalMessage = embedVisibleCode(link.messageTemplate, sessionCode);
  }
  // TIME_WINDOW: message goes out unmodified — matching relies on receive-time correlation.

  await prisma.pixelSession.update({
    where: { id: session.id },
    data: { lastTrackingLinkId: link.id },
  });

  const waLink = `https://wa.me/${link.waNumber}?text=${encodeURIComponent(finalMessage)}`;
  return NextResponse.json({ waLink });
}
