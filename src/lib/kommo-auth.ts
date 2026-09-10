import { KommoClient } from 'kommo-aiatende-api';
import { prisma } from '@/lib/prisma';

const TOKENS_API_URL = 'https://tokens.aiatende.dev.br';

export class KommoAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'KommoAuthError';
    this.status = status;
  }
}

/**
 * Same tokens.aiatende.dev.br broker the portal uses (lib/kommo-auth.ts there) — confirmed
 * that service authenticates callers with one shared key (AIATENDE_API_KEY), not a
 * per-app-registered credential, so TrackFlow reuses it directly instead of holding its own
 * Kommo OAuth app/tokens. `tenantId` here is the PORTAL's Client.id (Client.portalClientId in
 * TrackFlow), since that's the tenant identity the tokens were originally issued under when
 * the client connected Kommo through the portal.
 */
async function fetchKommoToken(subdomain: string, tenantId: string): Promise<string> {
  const res = await fetch(`${TOKENS_API_URL}/kommo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.AIATENDE_API_KEY ?? '',
    },
    body: JSON.stringify({ subdomain, tenant_id: tenantId, defaultAccount: false }),
  });

  if (!res.ok) {
    throw new KommoAuthError(`Tokens service error: ${res.status}`, 502);
  }

  const json = await res.json();
  if (!json.success || !json.data?.accessToken) {
    throw new KommoAuthError('Invalid response from tokens service', 502);
  }

  return json.data.accessToken;
}

/** Resolves a KommoClient for (subdomain, portal tenantId). Throws KommoAuthError on failure. */
export async function getKommoClient(subdomain: string, tenantId: string): Promise<KommoClient> {
  const accessToken = await fetchKommoToken(subdomain, tenantId);
  return new KommoClient({ domain: subdomain, accessToken });
}

/**
 * Resolves a KommoClient straight from a TrackFlow clientId — the (client + IntegrationConfig +
 * getKommoClient) lookup repeated across syncToKommo, leadJourney.ts, and the journey-stage
 * config routes. Returns null (not a throw) when Kommo simply isn't configured for this client
 * yet, since that's an expected/common state, not an error condition.
 */
export async function getKommoClientForClient(
  clientId: string,
): Promise<{ kommo: KommoClient; subdomain: string } | null> {
  const [client, integrationConfig] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.integrationConfig.findFirst({ where: { clientId, provider: 'KOMMO' } }),
  ]);

  const subdomain = (integrationConfig?.config as { subdomain?: string } | null)?.subdomain;
  if (!client?.portalClientId || !subdomain) return null;

  const kommo = await getKommoClient(subdomain, client.portalClientId);
  return { kommo, subdomain };
}
