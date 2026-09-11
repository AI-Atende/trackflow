/**
 * Brazilian mobile numbers gained an extra "9" prefix on the subscriber part in 2012, and
 * different systems disagree on whether to include it in wa_id-style digit strings: Kommo's
 * contact phone field (source of Lead.waId) usually keeps whatever the client/CRM entered, while
 * WhatsApp's own inbound wa_id (source of TrackedMessage.waId, relayed by the portal's messaging
 * webhook) is well known to sometimes drop it. An exact-string waId match then silently misses a
 * real match. Returns every plausible variant (the input as-is, plus the with/without-9 form for
 * a Brazilian mobile-shaped number) so callers can match with `waId: { in: variants }` instead of
 * a single exact string.
 */
export function brPhoneVariants(waId: string): string[] {
  const digits = waId.replace(/\D/g, '');
  if (!digits.startsWith('55')) return [digits];

  const rest = digits.slice(2); // after the 55 country code
  if (rest.length === 11 && rest[2] === '9') {
    // DDD + 9 + 8-digit subscriber number -> also try without the 9
    const withoutNine = rest.slice(0, 2) + rest.slice(3);
    return [digits, `55${withoutNine}`];
  }
  if (rest.length === 10) {
    // DDD + 8-digit subscriber number -> also try with a 9 inserted
    const withNine = rest.slice(0, 2) + '9' + rest.slice(2);
    return [digits, `55${withNine}`];
  }
  return [digits];
}
