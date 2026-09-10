const TRACKFLOW_API_KEY = process.env.TRACKFLOW_API_KEY || '';
// Same fallback pattern as TRACKFLOW_INTERNAL_URL on the portal's side: PORTAL_INTERNAL_URL is
// only needed for local Docker Desktop (host.docker.internal), where "PORTAL_BASE_URL" (the
// public URL) isn't reachable from inside a container the same way. In production, leave
// PORTAL_INTERNAL_URL unset — it falls back to PORTAL_BASE_URL, the portal's real public URL.
const PORTAL_INTERNAL_URL = process.env.PORTAL_INTERNAL_URL || process.env.PORTAL_BASE_URL || '';

export interface PortalWhatsAppNumber {
  phoneNumberId: string;
  displayNumber: string;
  // 'whatsapp' = official Cloud API (has a WABA); 'whatsapp_lite' = QR Code connection (never
  // has a WABA — not onboarded through Meta's Business Platform at all).
  channel: 'whatsapp' | 'whatsapp_lite';
  wabaId: string | null;
}

/**
 * Fetches the client's already-registered WhatsApp numbers from the portal's own messaging
 * platform integration, so a TrackingLink can offer them as options instead of the client
 * having to type a number in from scratch. Best-effort — returns an empty list on any failure
 * (missing config, portal unreachable, not provisioned) rather than throwing, since "no
 * suggestions, type it manually" is a perfectly fine degraded state for this UI.
 */
export async function fetchPortalWhatsAppNumbers(
  portalClientId: string,
): Promise<PortalWhatsAppNumber[]> {
  if (!PORTAL_INTERNAL_URL || !TRACKFLOW_API_KEY) return [];

  try {
    const res = await fetch(
      `${PORTAL_INTERNAL_URL}/api/internal/trackflow/whatsapp-numbers?portalClientId=${encodeURIComponent(portalClientId)}`,
      { headers: { 'x-api-key': TRACKFLOW_API_KEY } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.numbers) ? data.numbers : [];
  } catch {
    return [];
  }
}
