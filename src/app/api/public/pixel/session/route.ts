import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateShortCode } from '@/lib/tracking-codes';
import { withPixelCors, pixelCorsPreflight } from '@/lib/pixel-cors';

// POST /api/public/pixel/session — called by the pixel script on page load. Public/unauthenticated
// (identified by clientId, the same opaque cuid used everywhere else — no separate "pixel id"
// needed). Idempotent: if the browser already has a sessionCode (from a previous page view in
// this visit) AND the current page has no new UTM/click-id params, it's reused as-is — keeps a
// multi-page visit under one attribution. But if the current URL DOES carry fresh UTM/click-id
// data, that always wins over a stale cached session — otherwise a visitor returning later via
// a different (or first real) campaign link would silently keep whatever empty/old attribution
// happened to already be sitting in their browser's localStorage from an earlier, untagged visit.
export async function OPTIONS() {
  return pixelCorsPreflight();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.clientId) {
    return withPixelCors(NextResponse.json({ error: 'clientId is required' }, { status: 400 }));
  }

  const client = await prisma.client.findUnique({ where: { id: body.clientId } });
  if (!client) {
    return withPixelCors(NextResponse.json({ error: 'Unknown client' }, { status: 404 }));
  }

  const incomingTrackingData = {
    utmSource: body.utmSource ?? null,
    utmMedium: body.utmMedium ?? null,
    utmCampaign: body.utmCampaign ?? null,
    utmContent: body.utmContent ?? null,
    utmTerm: body.utmTerm ?? null,
    fbclid: body.fbclid ?? null,
    gclid: body.gclid ?? null,
    gbraid: body.gbraid ?? null,
    wbraid: body.wbraid ?? null,
  };
  const hasNewTrackingData = Object.values(incomingTrackingData).some((v) => v !== null);

  if (body.existingSessionCode) {
    const existing = await prisma.pixelSession.findUnique({
      where: { sessionCode: body.existingSessionCode },
    });
    if (existing && existing.clientId === client.id) {
      if (hasNewTrackingData) {
        await prisma.pixelSession.update({
          where: { id: existing.id },
          data: { ...incomingTrackingData, landingUrl: body.landingUrl ?? existing.landingUrl },
        });
      }
      return withPixelCors(NextResponse.json({ sessionCode: existing.sessionCode }));
    }
  }

  const sessionCode = generateShortCode();
  await prisma.pixelSession.create({
    data: {
      clientId: client.id,
      sessionCode,
      ...incomingTrackingData,
      landingUrl: body.landingUrl ?? null,
    },
  });

  return withPixelCors(NextResponse.json({ sessionCode }));
}
