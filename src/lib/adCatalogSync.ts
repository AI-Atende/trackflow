import { prisma } from '@/lib/prisma';
import { fetchAllMetaItems } from '@/services/metaService';

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

  const fields = 'id,name,status,effective_status';
  const [campaigns, adsets, ads] = await Promise.all([
    fetchAllMetaItems<MetaApiCampaign>(
      `/${activeAccount.adAccountId}/campaigns`,
      activeAccount.accessToken,
      {
        fields,
        limit: 500,
      },
      { throwOnError: true },
    ),
    fetchAllMetaItems<MetaApiAdSet>(
      `/${activeAccount.adAccountId}/adsets`,
      activeAccount.accessToken,
      {
        fields: `${fields},campaign_id`,
        limit: 500,
      },
      { throwOnError: true },
    ),
    fetchAllMetaItems<MetaApiAd>(
      `/${activeAccount.adAccountId}/ads`,
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
        campaignExternalId: campaign.id,
        campaignName: campaign.name,
        adsetExternalId: adset.id,
        adsetName: adset.name,
      },
      update: {
        adName: ad.name,
        adStatus: ad.effective_status ?? ad.status,
        campaignExternalId: campaign.id,
        campaignName: campaign.name,
        adsetExternalId: adset.id,
        adsetName: adset.name,
        lastSyncedAt: new Date(),
      },
    });
    synced++;
  }

  console.log(
    `[adCatalogSync] client ${clientId}: fetched ${campaigns.length} campaign(s), ${adsets.length} adset(s), ${ads.length} ad(s) — synced ${synced}, orphaned ${orphaned}`,
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
