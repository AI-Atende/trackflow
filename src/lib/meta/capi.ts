import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

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
  const [accounts, fieldMapping] = await Promise.all([
    prisma.metaAdAccount.findMany({ where: { clientId } }),
    prisma.kommoFieldMapping.findUnique({ where: { clientId } }),
  ]);
  const account = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  if (!account?.pixelId || !account?.capiAccessToken) {
    throw new Error('Meta Conversions API não configurada (pixelId/capiAccessToken ausentes)');
  }
  if (!lead.waId) {
    throw new Error('Lead sem telefone conhecido — não é possível enviar evento pra Meta');
  }

  const userData: Record<string, unknown> = {
    ph: [sha256(lead.waId)],
    external_id: [sha256(lead.id)],
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
