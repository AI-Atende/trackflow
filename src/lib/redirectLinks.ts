import { prisma } from '@/lib/prisma';
import { embedInvisibleCode, embedVisibleCode, generateShortCode } from '@/lib/tracking-codes';

// Lowercase letters/digits separated by single hyphens — safe in a URL path and in a QR code
// without any encoding, and case-insensitive by construction (slugs are always stored lowercase).
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 60;

/** Lowercases/trims user input into slug shape; does not validate — pair with isValidSlug. */
export function normalizeSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= SLUG_MIN_LENGTH && slug.length <= SLUG_MAX_LENGTH && SLUG_REGEX.test(slug);
}

/**
 * The client's public namespace for redirect URLs, generated on first use. Retries on the
 * (unlikely) unique collision rather than trusting 6 hex chars to never repeat.
 */
export async function ensureClientShortKey(clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { shortKey: true },
  });
  if (client?.shortKey) return client.shortKey;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateShortCode(6);
    try {
      const updated = await prisma.client.updateMany({
        where: { id: clientId, shortKey: null },
        data: { shortKey: candidate },
      });
      if (updated.count === 0) {
        // Lost a race with a concurrent request that already set one — read theirs.
        const current = await prisma.client.findUnique({
          where: { id: clientId },
          select: { shortKey: true },
        });
        if (current?.shortKey) return current.shortKey;
      } else {
        return candidate;
      }
    } catch {
      // unique violation on shortKey — try another candidate
    }
  }
  throw new Error('Não foi possível gerar a chave pública do cliente');
}

/**
 * Public origin used to build the shareable redirect URL. REDIRECT_BASE_URL lets a short
 * dedicated domain be used for printed QR codes; falls back to NEXTAUTH_URL, then to whatever
 * origin the caller already knows (the request's, in the browser).
 */
export function getRedirectBaseUrl(fallbackOrigin = ''): string {
  const base = process.env.REDIRECT_BASE_URL || process.env.NEXTAUTH_URL || fallbackOrigin;
  return base.replace(/\/+$/, '');
}

export function buildRedirectUrl(shortKey: string, slug: string, fallbackOrigin = ''): string {
  return `${getRedirectBaseUrl(fallbackOrigin)}/r/${shortKey}/${slug}`;
}

/** Same wa.me link the pixel's wa-link endpoint builds — one place so both stay in sync. */
export function buildWaLink(
  link: { waNumber: string; messageTemplate: string; codingStrategy: string },
  sessionCode: string | null,
): string {
  let finalMessage = link.messageTemplate;
  if (sessionCode) {
    if (link.codingStrategy === 'INVISIBLE') {
      finalMessage = embedInvisibleCode(link.messageTemplate, sessionCode);
    } else if (link.codingStrategy === 'VISIBLE_CODE') {
      finalMessage = embedVisibleCode(link.messageTemplate, sessionCode);
    }
    // TIME_WINDOW: message goes out unmodified — matching relies on receive-time correlation.
  }
  return `https://wa.me/${link.waNumber}?text=${encodeURIComponent(finalMessage)}`;
}

// Link-preview fetchers, crawlers and scripted clients open a URL the moment it's pasted in a
// chat or post — without any human visiting. Counting those as visits would create a PixelSession
// that never turns into a message (and would feed the TIME_WINDOW heuristic bogus candidates).
// In-app browsers of real users (Instagram, Facebook's FBAN/FBAV) are deliberately NOT listed.
const BOT_UA_REGEX =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|skype|linkedin|embedly|pinterest|vkshare|curl|wget|python|axios|node-fetch|go-http|java\/|okhttp|libwww|headless|lighthouse|pingdom|uptime|monitor|validator/i;

export function isLikelyBot(headers: Headers, method = 'GET'): boolean {
  if (method === 'HEAD') return true;

  const purpose = (
    headers.get('sec-purpose') ??
    headers.get('purpose') ??
    headers.get('x-purpose') ??
    headers.get('x-moz') ??
    ''
  ).toLowerCase();
  if (purpose.includes('prefetch') || purpose.includes('preview')) return true;

  const ua = headers.get('user-agent');
  if (!ua) return true;
  return BOT_UA_REGEX.test(ua);
}
