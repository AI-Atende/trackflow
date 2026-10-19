import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateShortCode } from '@/lib/tracking-codes';
import { buildWaLink, isLikelyBot } from '@/lib/redirectLinks';

// Public, unauthenticated, never cached — every visit must reach the server so it can create
// its own PixelSession and embed that session's code in the wa.me message.
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ clientKey: string; slug: string }> };

const UTM_PARAMS = [
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmContent', 'utm_content'],
  ['utmTerm', 'utm_term'],
] as const;
const CLICK_ID_PARAMS = ['fbclid', 'gclid', 'gbraid', 'wbraid'] as const;

function notFound() {
  return new NextResponse('Link não encontrado.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function redirectTo(url: string) {
  // 302 (not 301): a permanent redirect would be cached by browsers/proxies and later visits
  // would skip us entirely — no new session, no code, no attribution.
  const res = NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

async function handle(req: NextRequest, { params }: RouteContext, method: 'GET' | 'HEAD') {
  const { clientKey, slug } = await params;

  const link = await prisma.trackingLink.findFirst({
    where: { slug: slug.toLowerCase(), client: { shortKey: clientKey } },
  });
  if (!link) return notFound();

  // Previews/crawlers still get a working redirect (so the link "works" when pasted into a
  // chat), just without creating a session or embedding a code — that would be a phantom visit.
  if (isLikelyBot(req.headers, method)) {
    return redirectTo(buildWaLink(link, null));
  }

  const query = req.nextUrl.searchParams;
  const sessionData: Record<string, string | null> = {};
  for (const [field, param] of UTM_PARAMS) {
    // The visited URL's own params win; the link's configured origin tag only fills the gaps.
    sessionData[field] = query.get(param) || link[field] || null;
  }
  for (const param of CLICK_ID_PARAMS) {
    sessionData[param] = query.get(param) || null;
  }

  const sessionCode = generateShortCode();
  try {
    await prisma.pixelSession.create({
      data: {
        clientId: link.clientId,
        sessionCode,
        ...sessionData,
        // Path + query only, no host — and deliberately no IP / user-agent stored: the visit
        // only needs to be correlated with a message later, not to identify the visitor.
        landingUrl: `${req.nextUrl.pathname}${req.nextUrl.search}`,
        lastTrackingLinkId: link.id,
      },
    });
  } catch (err) {
    // Never strand a visitor on an error page over a tracking failure — the redirect itself
    // is what they came for. They land in WhatsApp untracked.
    console.error('[redirect-link] failed to create session', err);
    return redirectTo(buildWaLink(link, null));
  }

  return redirectTo(buildWaLink(link, sessionCode));
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx, 'GET');
}

export async function HEAD(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx, 'HEAD');
}
