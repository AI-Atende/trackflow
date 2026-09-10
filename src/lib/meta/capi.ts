import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { fetchPortalWhatsAppNumbers } from '@/lib/portal-client';

const META_GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface SendMetaConversionEventInput {
  clientId: string;
  lead: {
    id: string;
    waId: string | null;
    fbclid: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    saleValue: number | null;
  };
  eventName: string;
}

// Meta discards a business_messaging event tied to a ctwa_clid older than this — using a stale
// one would just trade "missing field" errors for "expired click id" ones.
const CTWA_CLID_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface MessagingAttribution {
  wabaId: string | null;
  ctwaClid: string | null;
}

/**
 * Resolves the two things Meta's CTWA-specific "business_messaging" event type needs on top of
 * the normal match keys: the WABA behind the exact number that talked to this lead, and a still-
 * fresh ctwa_clid (Meta's own click id, only present when the lead's first message carried
 * Click-to-WhatsApp ad referral data). Both come from the most recent TrackedMessage for this
 * lead's phone (see api/internal/messages/received).
 *
 * TrackFlow doesn't capture ctwa_clid yet — the portal's webhook relay has the field wired
 * through (see app/api/webhooks/messaging/[clientId]/route.ts on the portal), but the messaging
 * platform itself (core-api) doesn't expose it in message.received today. Until it does, this
 * always resolves to { wabaId: null, ctwaClid: null }, and sendMetaConversionEvent below falls
 * back to the generic action_source — no code change needed here once that lands upstream.
 */
async function resolveMessagingAttribution(
  clientId: string,
  waId: string,
  portalClientId: string | null,
): Promise<MessagingAttribution> {
  const none: MessagingAttribution = { wabaId: null, ctwaClid: null };

  const lastMessage = await prisma.trackedMessage.findFirst({
    where: { clientId, waId, phoneNumberId: { not: null } },
    orderBy: { receivedAt: 'desc' },
    select: { phoneNumberId: true, ctwaClid: true, receivedAt: true },
  });
  if (!lastMessage?.phoneNumberId) return none;

  const ctwaClid =
    lastMessage.ctwaClid && Date.now() - lastMessage.receivedAt.getTime() <= CTWA_CLID_MAX_AGE_MS
      ? lastMessage.ctwaClid
      : null;
  if (!ctwaClid) return none; // no usable click id — a WABA alone isn't enough for business_messaging

  const portalNumbers = portalClientId ? await fetchPortalWhatsAppNumbers(portalClientId) : [];
  const matchedNumber = portalNumbers.find((n) => n.phoneNumberId === lastMessage.phoneNumberId);
  const wabaId = matchedNumber?.channel === 'whatsapp' ? (matchedNumber.wabaId ?? null) : null;
  return wabaId ? { wabaId, ctwaClid } : none;
}

// Events past this point in the funnel carry a monetary value worth telling Meta about — needed
// for value-based optimization. Extend this list if more value-bearing standard events get added.
const VALUE_EVENT_NAMES = new Set(['Purchase']);

/**
 * Sends one server-side event via Meta's Conversions API. Matches primarily on the lead's phone
 * number (this is a WhatsApp-originated lead, not a website form) — email, name and fbc are
 * additional match keys that raise Event Match Quality (Meta's own metric for how likely it is to
 * connect the event to a real ad click/user). No dedicated CAPI credential discovery flow exists;
 * pixelId/capiAccessToken are pasted by the client from Meta's Events Manager (see
 * MetaAdAccount.pixelId/capiAccessToken).
 */
export async function sendMetaConversionEvent({
  clientId,
  lead,
  eventName,
}: SendMetaConversionEventInput): Promise<void> {
  const [accounts, fieldMapping, client] = await Promise.all([
    prisma.metaAdAccount.findMany({ where: { clientId } }),
    prisma.kommoFieldMapping.findUnique({ where: { clientId } }),
    prisma.client.findUnique({ where: { id: clientId }, select: { portalClientId: true } }),
  ]);
  const account = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  if (!account?.pixelId || !account?.capiAccessToken) {
    throw new Error('Meta Conversions API não configurada (pixelId/capiAccessToken ausentes)');
  }
  if (!lead.waId) {
    throw new Error('Lead sem telefone conhecido — não é possível enviar evento pra Meta');
  }

  // business_messaging (Meta's CTWA-specific event type) needs a WABA + a fresh ctwa_clid on top
  // of the usual match keys — only send that way when we actually have both for this lead; every
  // other lead (the overwhelming majority today, since ctwa_clid isn't captured upstream yet)
  // gets the generic CRM-style event instead, which needs neither.
  const { wabaId, ctwaClid } = await resolveMessagingAttribution(
    clientId,
    lead.waId,
    client?.portalClientId ?? null,
  );
  const useBusinessMessaging = Boolean(wabaId && ctwaClid);

  const userData: Record<string, unknown> = {
    ph: [sha256(lead.waId)],
    external_id: [sha256(lead.id)],
  };
  if (useBusinessMessaging) {
    // Meta's actual v19.0 validation error names this "page_id" even for the whatsapp channel,
    // while the newer docs sample shows "whatsapp_business_account_id" — sending both covers
    // either validation path without depending on which one this API version checks.
    userData.page_id = wabaId;
    userData.whatsapp_business_account_id = wabaId;
    userData.ctwa_clid = ctwaClid;
  }
  if (lead.email) userData.em = [sha256(lead.email)];
  if (lead.firstName) userData.fn = [sha256(lead.firstName)];
  if (lead.lastName) userData.ln = [sha256(lead.lastName)];
  // fbc's real click timestamp isn't stored — Date.now() at send-time is an approximation Meta
  // tolerates; fbclid itself (not the timestamp) is what actually drives the attribution match.
  if (lead.fbclid) {
    userData.fbc = `fb.1.${Date.now()}.${lead.fbclid}`;
  }

  const customData: Record<string, unknown> = {};
  if (VALUE_EVENT_NAMES.has(eventName) && lead.saleValue != null) {
    customData.value = lead.saleValue;
    customData.currency = fieldMapping?.defaultCurrency ?? 'BRL';
  }

  const res = await fetch(`${META_GRAPH_API_BASE}/${account.pixelId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: account.capiAccessToken,
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          // 'system_generated' is Meta's documented action_source for CRM-driven events (a lead
          // reaching a stage in Kommo, not a live interaction) — matches only via user_data, no
          // WABA/messaging_channel/ctwa_clid needed. 'business_messaging' (Meta's CTWA-specific
          // type) only kicks in once resolveMessagingAttribution found a real WABA + fresh
          // ctwa_clid for this lead — see useBusinessMessaging above.
          action_source: useBusinessMessaging ? 'business_messaging' : 'system_generated',
          ...(useBusinessMessaging ? { messaging_channel: 'whatsapp' } : {}),
          user_data: userData,
          ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta CAPI error ${res.status}: ${text}`);
  }
}
