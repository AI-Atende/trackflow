import { NextResponse } from 'next/server';

// The pixel endpoints are called via fetch() from arbitrary client websites (a different
// origin than TrackFlow itself) — every response needs CORS headers or the browser blocks it,
// regardless of how the pixel script was injected (plain <script>, GTM, etc). Allow-all is
// intentional: these routes don't use cookies/session auth, they're keyed by clientId/session
// code in the body, so there's no cross-site credential to leak.
export function withPixelCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

export function pixelCorsPreflight(): NextResponse {
  return withPixelCors(new NextResponse(null, { status: 204 }));
}
