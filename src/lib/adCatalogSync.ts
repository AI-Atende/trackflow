import { prisma } from '@/lib/prisma';
import { fetchAllMetaItems } from '@/services/metaService';
import { googleAdsClient } from '@/lib/google-ads';

interface MetaApiCampaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
}
interface MetaApiAdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
}
interface MetaApiAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  adset_id: string;
}

/**
 * Soft-deletes MappedAd rows for ads that the API no longer returns (`adExternalId` not in
 * `seenExternalIds`) — never a hard delete, since past leads may still reference the ad via
 * TrackedMessage.resolvedAdMatchConfidence, and an ad can come back (`removedAt` gets reset to
 * null by the upsert `update` clause the next time it's seen).
 */
async function markMissingAdsAsRemoved(
  clientId: string,
  platform: 'META' | 'GOOGLE',
  seenExternalIds: string[],
): Promise<number> {
  const result = await prisma.mappedAd.updateMany({
    where: { clientId, platform, adExternalId: { notIn: seenExternalIds }, removedAt: null },
    data: { removedAt: new Date() },
  });
  return result.count;
}

/**
 * Pulls the FULL current campaign/adset/ad structure for a client's Meta ad account (no date
 * filter — this is a catalog, not a metrics sync) and upserts it into MappedAd. Called both by
 * the manual "Sincronizar agora" button (api/ad-catalog/sync) and the periodic cron
 * (instrumentation.ts) — same function either way, no separate code paths to drift apart.
 */
export async function syncMetaAdCatalog(clientId: string): Promise<{ synced: number } | null> {
  // Same "prefer ACTIVE, else whatever's there" pick used elsewhere in this app (e.g. the
  // dashboard route) — no multi-account picker yet, just the one primary account.
  const accounts = await prisma.metaAdAccount.findMany({ where: { clientId } });
  const activeAccount = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  if (!activeAccount) return null;

  // MetaAdAccount.adAccountId is stored bare (the `account_id` field from /me/adaccounts, no
  // `act_` prefix — see api/integrations/meta/accounts/route.ts). The campaigns/adsets/ads edges
  // only exist on the `act_<id>` node; hitting the bare numeric id 404s with a misleading
  // "Tried accessing nonexisting field" error. Same normalization syncInsightsDaily.ts already
  // does before its own Graph API calls.
  const apiAdAccountId = activeAccount.adAccountId.startsWith('act_')
    ? activeAccount.adAccountId
    : `act_${activeAccount.adAccountId}`;

  const fields = 'id,name,status,effective_status';
  const [campaigns, adsets, ads] = await Promise.all([
    fetchAllMetaItems<MetaApiCampaign>(
      `/${apiAdAccountId}/campaigns`,
      activeAccount.accessToken,
      {
        fields,
        limit: 500,
      },
      { throwOnError: true },
    ),
    fetchAllMetaItems<MetaApiAdSet>(
      `/${apiAdAccountId}/adsets`,
      activeAccount.accessToken,
      {
        fields: `${fields},campaign_id`,
        limit: 500,
      },
      { throwOnError: true },
    ),
    fetchAllMetaItems<MetaApiAd>(
      `/${apiAdAccountId}/ads`,
      activeAccount.accessToken,
      {
        fields: `${fields},adset_id`,
        limit: 500,
      },
      { throwOnError: true },
    ),
  ]);

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const adsetById = new Map(adsets.map((a) => [a.id, a]));

  let orphaned = 0;
  let synced = 0;
  for (const ad of ads) {
    const adset = adsetById.get(ad.adset_id);
    const campaign = adset ? campaignById.get(adset.campaign_id) : undefined;
    if (!adset || !campaign) {
      // orphaned ad (rare) — skip rather than write a half-row
      orphaned++;
      continue;
    }

    await prisma.mappedAd.upsert({
      where: {
        clientId_platform_adExternalId: { clientId, platform: 'META', adExternalId: ad.id },
      },
      create: {
        clientId,
        platform: 'META',
        adExternalId: ad.id,
        adName: ad.name,
        adStatus: ad.effective_status ?? ad.status,
        adAccountId: activeAccount.adAccountId,
        campaignExternalId: campaign.id,
        campaignName: campaign.name,
        adsetExternalId: adset.id,
        adsetName: adset.name,
      },
      update: {
        adName: ad.name,
        adStatus: ad.effective_status ?? ad.status,
        adAccountId: activeAccount.adAccountId,
        campaignExternalId: campaign.id,
        campaignName: campaign.name,
        adsetExternalId: adset.id,
        adsetName: adset.name,
        lastSyncedAt: new Date(),
        removedAt: null, // in case it was previously marked removed and has since come back
      },
    });
    synced++;
  }

  // Orphaned ads are still returned by the API (they exist in the account, just missing a
  // resolvable adset/campaign on our end) — count them as "seen" too, so they aren't wrongly
  // marked removed.
  const removed = await markMissingAdsAsRemoved(
    clientId,
    'META',
    ads.map((ad) => ad.id),
  );

  console.log(
    `[adCatalogSync] client ${clientId}: fetched ${campaigns.length} campaign(s), ${adsets.length} adset(s), ${ads.length} ad(s) — synced ${synced}, orphaned ${orphaned}, removed ${removed}`,
  );

  return { synced };
}

/** Runs the Meta catalog sync for every client with a connected Meta ad account — used by the cron. */
export async function syncAllMetaAdCatalogs(): Promise<void> {
  const clients = await prisma.metaAdAccount.findMany({
    select: { clientId: true },
    distinct: ['clientId'],
  });

  for (const { clientId } of clients) {
    try {
      const result = await syncMetaAdCatalog(clientId);
      console.log(`[adCatalogSync] client ${clientId}: synced ${result?.synced ?? 0} ad(s)`);
    } catch (err) {
      console.error(`[adCatalogSync] client ${clientId} failed`, err);
    }
  }
}

interface GoogleApiCampaignRow {
  campaign: { id: string | number; name: string; status?: string };
}
interface GoogleApiAdGroupRow {
  ad_group: { id: string | number; name: string; status?: string };
  campaign: { id: string | number };
}
interface GoogleApiAdRow {
  ad_group_ad: { ad: { id: string | number; name?: string }; status?: string };
  ad_group: { id: string | number };
}

/**
 * Google equivalent of syncMetaAdCatalog — same shape, same MappedAd table (platform: 'GOOGLE'),
 * same catalog-only semantics (no metrics, no date filter — see fetchGoogleHierarchy in
 * googleService.ts for the metrics-sync version these queries are stripped down from).
 */
export async function syncGoogleAdCatalog(clientId: string): Promise<{ synced: number } | null> {
  const accounts = await prisma.googleAdAccount.findMany({ where: { clientId } });
  const activeAccount = accounts.find((a) => a.status === 'ACTIVE') ?? accounts[0];
  if (!activeAccount) return null;

  // customerId is stored as bare digits in practice (confirmed at every write site), despite the
  // schema comment suggesting a dashed format — strip defensively, same as fetchGoogleHierarchy.
  const customer = googleAdsClient.Customer({
    customer_id: activeAccount.customerId.replace(/-/g, ''),
    refresh_token: activeAccount.refreshToken,
    login_customer_id: activeAccount.managerId ?? undefined,
  });

  let campaigns: GoogleApiCampaignRow[];
  let adGroups: GoogleApiAdGroupRow[];
  let ads: GoogleApiAdRow[];
  let currencyCode: string | null = null;
  try {
    // The library's row types mark every field optional/nullable (it can't know ahead of time
    // which fields a given GAQL SELECT populates) — same `as unknown as` cast fetchGoogleHierarchy
    // already uses, since we know from the SELECT clauses above exactly what's present.
    const [campaignRows, adGroupRows, adRows, customerRows] = await Promise.all([
      customer.query('SELECT campaign.id, campaign.name, campaign.status FROM campaign'),
      customer.query(
        'SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id FROM ad_group',
      ),
      customer.query(
        'SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group.id FROM ad_group_ad',
      ),
      // Piggybacks on this same periodic sync so currencyCode stays fresh without a dedicated
      // job — the account's currency essentially never changes, no need to fetch it more often.
      customer.query('SELECT customer.currency_code FROM customer'),
    ]);
    campaigns = campaignRows as unknown as GoogleApiCampaignRow[];
    adGroups = adGroupRows as unknown as GoogleApiAdGroupRow[];
    ads = adRows as unknown as GoogleApiAdRow[];
    const customerRow = (customerRows as unknown as { customer: { currency_code?: string } }[])[0];
    currencyCode = customerRow?.customer?.currency_code ?? null;
  } catch (err) {
    console.error(`[adCatalogSync] Google query failed for client ${clientId}`, err);
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (currencyCode && currencyCode !== activeAccount.currencyCode) {
    await prisma.googleAdAccount.update({
      where: { id: activeAccount.id },
      data: { currencyCode },
    });
  }

  const campaignById = new Map(campaigns.map((c) => [String(c.campaign.id), c.campaign]));
  const adGroupById = new Map(adGroups.map((ag) => [String(ag.ad_group.id), ag]));

  let orphaned = 0;
  let synced = 0;
  for (const row of ads) {
    const ad = row.ad_group_ad.ad;
    const adGroupRow = adGroupById.get(String(row.ad_group.id));
    const campaign = adGroupRow ? campaignById.get(String(adGroupRow.campaign.id)) : undefined;
    if (!adGroupRow || !campaign) {
      orphaned++;
      continue;
    }

    const adExternalId = String(ad.id);
    const adName = ad.name || `Ad ${adExternalId}`;
    const adStatus = String(row.ad_group_ad.status ?? 'UNKNOWN');
    const campaignExternalId = String(campaign.id);
    const campaignName = campaign.name;
    const adsetExternalId = String(adGroupRow.ad_group.id);
    const adsetName = adGroupRow.ad_group.name;

    await prisma.mappedAd.upsert({
      where: {
        clientId_platform_adExternalId: { clientId, platform: 'GOOGLE', adExternalId },
      },
      create: {
        clientId,
        platform: 'GOOGLE',
        adExternalId,
        adName,
        adStatus,
        campaignExternalId,
        campaignName,
        adsetExternalId,
        adsetName,
      },
      update: {
        adName,
        adStatus,
        campaignExternalId,
        campaignName,
        adsetExternalId,
        adsetName,
        lastSyncedAt: new Date(),
        removedAt: null, // in case it was previously marked removed and has since come back
      },
    });
    synced++;
  }

  const removed = await markMissingAdsAsRemoved(
    clientId,
    'GOOGLE',
    ads.map((row) => String(row.ad_group_ad.ad.id)),
  );

  console.log(
    `[adCatalogSync] client ${clientId}: fetched ${campaigns.length} campaign(s), ${adGroups.length} adset(s), ${ads.length} ad(s) [Google] — synced ${synced}, orphaned ${orphaned}, removed ${removed}`,
  );

  return { synced };
}

/** Runs the Google catalog sync for every client with a connected Google Ads account — used by the cron. */
export async function syncAllGoogleAdCatalogs(): Promise<void> {
  const clients = await prisma.googleAdAccount.findMany({
    select: { clientId: true },
    distinct: ['clientId'],
  });

  for (const { clientId } of clients) {
    try {
      const result = await syncGoogleAdCatalog(clientId);
      console.log(
        `[adCatalogSync] client ${clientId}: synced ${result?.synced ?? 0} ad(s) [Google]`,
      );
    } catch (err) {
      console.error(`[adCatalogSync] client ${clientId} failed [Google]`, err);
    }
  }
}

/**
 * Single entry point for "sync this client's whole ad catalog" — used by both the manual
 * "Sincronizar agora" button and (per-client, inside the loops above) the cron. Runs Meta and
 * Google independently so one platform failing doesn't hide the other succeeding.
 */
export async function syncAdCatalogForClient(clientId: string): Promise<{
  synced: number;
  connected: boolean;
  errors?: { meta?: string; google?: string };
}> {
  const errors: { meta?: string; google?: string } = {};
  let synced = 0;
  let connected = false;

  try {
    const metaResult = await syncMetaAdCatalog(clientId);
    if (metaResult) {
      connected = true;
      synced += metaResult.synced;
    }
  } catch (err) {
    connected = true; // an account exists, it just failed to sync — not "not connected"
    errors.meta = err instanceof Error ? err.message : String(err);
  }

  try {
    const googleResult = await syncGoogleAdCatalog(clientId);
    if (googleResult) {
      connected = true;
      synced += googleResult.synced;
    }
  } catch (err) {
    connected = true;
    errors.google = err instanceof Error ? err.message : String(err);
  }

  return Object.keys(errors).length > 0 ? { synced, connected, errors } : { synced, connected };
}

/** Runs both platforms' catalog syncs for every connected client — what the cron actually calls. */
export async function syncAllAdCatalogs(): Promise<void> {
  await syncAllMetaAdCatalogs();
  await syncAllGoogleAdCatalogs();
}
