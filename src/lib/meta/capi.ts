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

/**
 * Resolves the WABA ID behind the specific WhatsApp number that actually talked to this lead —
 * not just "any Cloud API number the client has" (a client can run Cloud API and Lite numbers
 * at once, and picking the wrong one would misattribute the event to an unrelated WABA). Prefers
 * the most recent TrackedMessage's phoneNumberId (recorded from the real inbound webhook, see
 * api/internal/messages/received); falls back to "the client's only Cloud API number" when there
 * is no message history to go on (e.g. a lead imported from existing Kommo data, never relayed
 * through the messaging webhook).
 */
async function resolveWabaIdForLead(
  clientId: string,
  waId: string,
  portalClientId: string | null,
): Promise<string> {
  const portalNumbers = portalClientId ? await fetchPortalWhatsAppNumbers(portalClientId) : [];

  const lastMessage = await prisma.trackedMessage.findFirst({
    where: { clientId, waId, phoneNumberId: { not: null } },
    orderBy: { receivedAt: 'desc' },
    select: { phoneNumberId: true },
  });

  if (lastMessage?.phoneNumberId) {
    const matchedNumber = portalNumbers.find((n) => n.phoneNumberId === lastMessage.phoneNumberId);
    if (matchedNumber?.channel === 'whatsapp_lite') {
      throw new Error(
        'Esse lead conversou por um número WhatsApp Lite (QR Code) — sem WABA, não é possível enviar evento pra Meta (só funciona com a API oficial do WhatsApp Business)',
      );
    }
    if (matchedNumber?.wabaId) {
      return matchedNumber.wabaId;
    }
    // Matched a phoneNumberId but the portal has no WABA for it (number disconnected/renamed
    // since) — fall through to the generic heuristic below rather than failing outright.
  }

  const wabaId = portalNumbers.find((n) => n.channel === 'whatsapp' && n.wabaId)?.wabaId;
  if (wabaId) return wabaId;

  if (portalNumbers.length > 0 && portalNumbers.every((n) => n.channel === 'whatsapp_lite')) {
    // Lite (QR Code) connections aren't onboarded through Meta's Business Platform, so they
    // never have a WABA — this isn't a missing-config issue, it's a hard limitation: Meta's
    // Conversions API for business_messaging only exists to track official Cloud API
    // conversations, so events from leads on a Lite number can't be sent to Meta at all.
    throw new Error(
      'Número conectado via WhatsApp Lite (QR Code) — sem WABA, não é possível enviar evento pra Meta (só funciona com a API oficial do WhatsApp Business)',
    );
  }
  throw new Error(
    'WhatsApp Business Account (WABA) não encontrado no portal — não é possível enviar evento pra Meta',
  );
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

  // Required by Meta on top of messaging_channel — the WhatsApp Business Account ID behind the
  // number that actually talked to this lead (not just any Cloud API number the client has).
  const wabaId = await resolveWabaIdForLead(clientId, lead.waId, client?.portalClientId ?? null);

  const userData: Record<string, unknown> = {
    ph: [sha256(lead.waId)],
    external_id: [sha256(lead.id)],
    // Meta's actual v19.0 validation error names this "page_id" even for the whatsapp channel,
    // while the newer docs sample shows "whatsapp_business_account_id" — sending both covers
    // either validation path without depending on which one this API version checks.
    page_id: wabaId,
    whatsapp_business_account_id: wabaId,
  };
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
          action_source: 'business_messaging',
          // Required by Meta whenever action_source is business_messaging — omitting it fails
          // every event with "Missing messaging channel parameter" (error_subcode 2804063).
          messaging_channel: 'whatsapp',
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
