import crypto from 'crypto';

// Zero-width encoding: the hidden code is converted to bits and spliced into the visible text
// as invisible Unicode characters, wrapped in a marker so extraction doesn't need to guess
// where the payload starts/ends. Not a hard guarantee against tampering (see plan doc) — some
// keyboards/OSes normalize away zero-width chars, and nothing stops a user from just deleting
// or rewriting the whole message. It's the best-effort default; VISIBLE_CODE is the fallback
// with better survivability at the cost of being visible.
const ZW_MARK = '​';
const ZW_ZERO = '‌';
const ZW_ONE = '‍';

/** Short random code used as the tracking id embedded in a message (hex, easy to print/read). */
export function generateShortCode(length = 8): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export function embedInvisibleCode(message: string, code: string): string {
  const bits = Array.from(code)
    .map((ch) => ch.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
  const encoded = Array.from(bits)
    .map((bit) => (bit === '1' ? ZW_ONE : ZW_ZERO))
    .join('');
  return `${message}${ZW_MARK}${encoded}${ZW_MARK}`;
}

export function extractInvisibleCode(text: string): string | null {
  const markerIndex = text.indexOf(ZW_MARK);
  if (markerIndex === -1) return null;
  const rest = text.slice(markerIndex + 1);
  const endIndex = rest.indexOf(ZW_MARK);
  if (endIndex === -1) return null;

  const encoded = rest.slice(0, endIndex);
  const bits = Array.from(encoded).map((ch) => (ch === ZW_ONE ? '1' : ch === ZW_ZERO ? '0' : null));
  if (bits.some((b) => b === null) || bits.length === 0 || bits.length % 8 !== 0) return null;

  const bytes = (bits as string[]).join('').match(/.{8}/g) ?? [];
  try {
    const decoded = bytes.map((byte) => String.fromCharCode(parseInt(byte, 2))).join('');
    return /^[0-9a-f]+$/i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function embedVisibleCode(message: string, code: string): string {
  return `${message}\n— ref: ${code}`;
}

export function extractVisibleCode(text: string): string | null {
  const match = text.match(/ref:\s*([0-9a-f]{4,16})\s*$/i);
  return match ? match[1].toLowerCase() : null;
}
