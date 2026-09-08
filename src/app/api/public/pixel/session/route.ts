import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateShortCode } from '@/lib/tracking-codes';

// POST /api/public/pixel/session — called by the pixel script on page load. Public/unauthenticated
// (identified by clientId, the same opaque cuid used everywhere else — no separate "pixel id"
// needed). Idempotent: if the browser already has a sessionCode (from a previous page view in
// this visit), pass it back as `existingSessionCode` and it's reused as-is instead of creating
// a new row, so a multi-page visit keeps one UTM attribution.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: body.clientId } });
  if (!client) {
    return NextResponse.json({ error: 'Unknown client' }, { status: 404 });
  }

  if (body.existingSessionCode) {
    const existing = await prisma.pixelSession.findUnique({
      where: { sessionCode: body.existingSessionCode },
    });
    if (existing && existing.clientId === client.id) {
      return NextResponse.json({ sessionCode: existing.sessionCode });
    }
  }

  const sessionCode = generateShortCode();
  await prisma.pixelSession.create({
    data: {
      clientId: client.id,
      sessionCode,
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
      utmContent: body.utmContent ?? null,
      utmTerm: body.utmTerm ?? null,
      fbclid: body.fbclid ?? null,
      gclid: body.gclid ?? null,
      gbraid: body.gbraid ?? null,
      wbraid: body.wbraid ?? null,
      landingUrl: body.landingUrl ?? null,
    },
  });

  return NextResponse.json({ sessionCode });
}
