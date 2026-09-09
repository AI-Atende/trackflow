import { prisma } from '@/lib/prisma';

export async function fetchMetaCampaigns(
  adAccountId: string,
  since: string,
  until: string,
): Promise<AdCampaign[]> {
  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { adAccountId },
    include: { client: { include: { integrations: true } } },
  });

  if (!metaAccount) {
    return [];
  }

  // Get Meta Config
  const metaConfig = metaAccount.client.integrations.find((i) => i.provider === 'META');
  const journeyMap = (metaConfig?.journeyMap as string[]) || ['impressions', 'clicks', 'leads'];

  const sinceDate = since.includes('T') ? new Date(since) : new Date(`${since}T00:00:00.000Z`);
  const untilDate = until.includes('T') ? new Date(until) : new Date(`${until}T23:59:59.999Z`);

  const rows = await prisma.metaAdInsightDaily.findMany({
    where: {
      metaAdAccountId: metaAccount.id,
      date: {
        gte: sinceDate,
        lte: untilDate,
      },
    },
  });

  type CampaignSummary = {
    campaignId: string;
    campaignName: string;
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalLeads: number;
    totalReach: number;
    totalResults: number;
  };

  const map = new Map<string, CampaignSummary>();

  for (const row of rows) {
    const key = row.campaignId;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        totalSpend: row.spend,
        totalImpressions: row.impressions,
        totalClicks: row.clicks,
        totalLeads: row.leads,
        totalReach: row.reach || 0,
        totalResults: row.results || 0,
      });
    } else {
      existing.totalSpend += row.spend;
      existing.totalImpressions += row.impressions;
      existing.totalClicks += row.clicks;
      existing.totalLeads += row.leads;
      existing.totalReach += row.reach || 0;
      existing.totalResults += row.results || 0;
    }
  }

  const calculateMetric = (metric: string, data: CampaignSummary) => {
    switch (metric) {
      case 'impressions':
        return data.totalImpressions;
      case 'clicks':
        return data.totalClicks;
      case 'leads':
        return data.totalLeads;
      case 'reach':
        return data.totalReach;
      case 'results':
        return data.totalResults;
      case 'spend':
        return data.totalSpend;
      case 'ctr':
        return data.totalImpressions > 0 ? (data.totalClicks / data.totalImpressions) * 100 : 0;
      case 'cpc':
        return data.totalClicks > 0 ? data.totalSpend / data.totalClicks : 0;
      case 'cpm':
        return data.totalImpressions > 0 ? (data.totalSpend / data.totalImpressions) * 1000 : 0;
      case 'cpa':
        return data.totalLeads > 0 ? data.totalSpend / data.totalLeads : 0;
      default:
        return 0;
    }
  };

  return Array.from(map.values()).map((c) => {
    const stageValues = journeyMap.map((metric) => calculateMetric(metric, c));

    // Last configured stage is the "Result" (metaLeads)
    const resultMetric = journeyMap[journeyMap.length - 1];
    const resultValue = calculateMetric(resultMetric, c);

    return {
      id: c.campaignId,
      name: c.campaignName,
      status: 'active',
      data: {
        stage1: stageValues[0] || 0,
        stage2: stageValues[1] || 0,
        stage3: stageValues[2] || 0,
        stage4: stageValues[3] || 0,
        stage5: stageValues[4] || 0,
      },
      spend: c.totalSpend,
      roas: 0,
      revenue: 0,
      metaLeads: resultValue,
    };
  });
}

import { metaGet } from '@/lib/meta/client';
import { AdCampaign, CampaignHierarchy } from '@/types';

// Helper to fetch all pages — exported for reuse by lib/adCatalogSync.ts
export async function fetchAllMetaItems<T>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined> = {},
  // fetchMetaHierarchy wants the old lenient behavior (log + fall back to whatever's in the DB,
  // never blow up the dashboard). adCatalogSync wants the opposite — a failed Graph API call
  // must not look identical to "this account genuinely has zero ads", so it passes true here.
  { throwOnError = false }: { throwOnError?: boolean } = {},
): Promise<T[]> {
  let allItems: T[] = [];
  const currentPath = path;
  let currentParams = params;
  let hasNext = true;

  while (hasNext) {
    try {
      const res = await metaGet<{ data: T[]; paging?: { next?: string } }>(
        currentPath,
        accessToken,
        currentParams,
      );
      if (res.data) {
        allItems = [...allItems, ...res.data];
      }

      if (res.paging?.next) {
        // Extract relative path and params from next URL if needed, or just use the full URL logic if metaGet supported it.
        // Since metaGet builds URL from base, we might need to handle 'next' carefully.
        // Simpler approach: metaGet expects path. If next is full URL, we need to parse it.
        // But usually for simple pagination we can just use 'after' cursor if we want to be clean,
        // OR just rely on the fact that we might not need massive pagination for this specific user case yet.
        // Let's try to parse the 'after' cursor from next url or just stop for now to avoid complexity if not strictly needed.
        // BETTER: Just use the 'after' cursor.
        if (res.paging.next) {
          const nextUrl = new URL(res.paging.next);
          const after = nextUrl.searchParams.get('after');
          if (after) {
            currentParams = { ...params, after };
          } else {
            hasNext = false;
          }
        } else {
          hasNext = false;
        }
      } else {
        hasNext = false;
      }
    } catch (e) {
      console.error('Error fetching meta items page:', e);
      if (throwOnError) throw e;
      hasNext = false;
    }
  }
  return allItems;
}

export async function fetchMetaHierarchy(
  adAccountId: string,
  since: string,
  until: string,
): Promise<CampaignHierarchy[]> {
  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { adAccountId },
    include: { client: { include: { integrations: true } } },
  });

  if (!metaAccount) {
    return [];
  }

  // Get Meta Config
  const metaConfig = metaAccount.client.integrations.find((i) => i.provider === 'META');
  const journeyMap = (metaConfig?.journeyMap as string[]) || ['impressions', 'clicks', 'leads'];

  const sinceDate = since.includes('T') ? new Date(since) : new Date(`${since}T00:00:00.000Z`);
  const untilDate = until.includes('T') ? new Date(until) : new Date(`${until}T23:59:59.999Z`);

  // 1. Fetch Metrics from DB (Source of Truth for Numbers)
  const rows = await prisma.metaAdInsightDaily.findMany({
    where: {
      metaAdAccountId: metaAccount.id,
      date: {
        gte: sinceDate,
        lte: untilDate,
      },
    },
  });

  // 2. Fetch Structure from API (Source of Truth for Existence & Status)
  // We fetch ALL items to ensure we show paused/inactive ones too.
  type MetaApiCampaign = { id: string; name: string; status: string; effective_status: string };
  type MetaApiAdSet = {
    id: string;
    name: string;
    status: string;
    effective_status: string;
    campaign_id: string;
  };
  type MetaApiAd = {
    id: string;
    name: string;
    status: string;
    effective_status: string;
    adset_id: string;
  };

  let apiCampaigns: MetaApiCampaign[] = [];
  let apiAdSets: MetaApiAdSet[] = [];
  let apiAds: MetaApiAd[] = [];

  // adAccountId is the bare, unprefixed id stored in MetaAdAccount (the `account_id` field from
  // /me/adaccounts) — the DB lookup above needs it bare, but the campaigns/adsets/ads edges only
  // exist on the `act_<id>` node. Same fix already applied in adCatalogSync.ts's syncMetaAdCatalog.
  const apiAdAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  try {
    const fields = 'id,name,status,effective_status';
    const [camps, adsets, ads] = await Promise.all([
      fetchAllMetaItems<MetaApiCampaign>(`/${apiAdAccountId}/campaigns`, metaAccount.accessToken, {
        fields,
        limit: 500,
      }),
      fetchAllMetaItems<MetaApiAdSet>(`/${apiAdAccountId}/adsets`, metaAccount.accessToken, {
        fields: `${fields},campaign_id`,
        limit: 500,
      }),
      fetchAllMetaItems<MetaApiAd>(`/${apiAdAccountId}/ads`, metaAccount.accessToken, {
        fields: `${fields},adset_id`,
        limit: 500,
      }),
    ]);
    apiCampaigns = camps;
    apiAdSets = adsets;
    apiAds = ads;
  } catch (error) {
    console.error('Error fetching Meta structure from API:', error);
    // Fallback? If API fails, we might return empty or rely on DB rows only (old behavior).
    // For now, let's proceed with empty structure and let the DB row fallback handle it (if we implement it).
  }

  // Helper to aggregate raw data
  type AggregatedData = {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    reach: number;
    results: number;
  };

  const aggregate = (target: AggregatedData, source: AggregatedData) => {
    target.spend += source.spend;
    target.impressions += source.impressions;
    target.clicks += source.clicks;
    target.leads += source.leads;
    target.reach += source.reach;
    target.results += source.results;
  };

  const calculateMetric = (metric: string, data: AggregatedData) => {
    switch (metric) {
      case 'impressions':
        return data.impressions;
      case 'clicks':
        return data.clicks;
      case 'leads':
        return data.leads;
      case 'reach':
        return data.reach;
      case 'results':
        return data.results;
      case 'spend':
        return data.spend;
      case 'ctr':
        return data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
      case 'cpc':
        return data.clicks > 0 ? data.spend / data.clicks : 0;
      case 'cpm':
        return data.impressions > 0 ? (data.spend / data.impressions) * 1000 : 0;
      case 'cpa':
        return data.leads > 0 ? data.spend / data.leads : 0;
      default:
        return 0;
    }
  };

  // Map to hold raw aggregated data
  const rawDataMap = new Map<string, AggregatedData>();
  const getRawData = (id: string) => {
    if (!rawDataMap.has(id)) {
      rawDataMap.set(id, { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0, results: 0 });
    }
    return rawDataMap.get(id)!;
  };

  // Aggregate DB metrics
  for (const row of rows) {
    const metrics = {
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      leads: row.leads,
      reach: row.reach || 0,
      results: row.results || 0,
    };
    aggregate(getRawData(row.campaignId), metrics);
    aggregate(getRawData(row.adsetId), metrics);
    aggregate(getRawData(row.adId), metrics);
  }

  // 3. Build Hierarchy
  const hierarchyMap = new Map<string, CampaignHierarchy>();

  // A. Create Campaign Nodes from API
  apiCampaigns.forEach((c) => {
    hierarchyMap.set(c.id, {
      id: c.id,
      name: c.name,
      type: 'campaign',
      status: (c.effective_status || c.status) as CampaignHierarchy['status'], // Use effective status if available
      data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
      spend: 0,
      roas: 0,
      revenue: 0,
      metaLeads: 0,
      children: [],
    });
  });

  // B. Attach AdSets
  apiAdSets.forEach((as) => {
    const camp = hierarchyMap.get(as.campaign_id);
    if (camp) {
      if (!camp.children) camp.children = [];
      camp.children.push({
        id: as.id,
        name: as.name,
        type: 'adset',
        status: (as.effective_status || as.status) as CampaignHierarchy['status'],
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        metaLeads: 0,
        children: [],
      });
    }
  });

  // C. Attach Ads
  apiAds.forEach((ad) => {
    // Find campaign then adset... slightly inefficient O(N*M), but N is small.
    // Better: Map of AdSets?
    // Let's iterate campaigns to find the adset.
    for (const camp of hierarchyMap.values()) {
      const adSet = camp.children?.find((as) => as.id === ad.adset_id);
      if (adSet) {
        if (!adSet.children) adSet.children = [];
        adSet.children.push({
          id: ad.id,
          name: ad.name,
          type: 'ad',
          status: (ad.effective_status || ad.status) as CampaignHierarchy['status'],
          data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
          spend: 0,
          roas: 0,
          revenue: 0,
          metaLeads: 0,
        });
        break; // Found it
      }
    }
  });

  // D. Fallback: Add items from DB that were NOT in API (e.g. deleted but have historical data)
  // This is important for data integrity.
  for (const row of rows) {
    // Campaign
    if (!hierarchyMap.has(row.campaignId)) {
      hierarchyMap.set(row.campaignId, {
        id: row.campaignId,
        name: row.campaignName, // Name from DB might be old, but better than nothing
        type: 'campaign',
        status: 'completed', // Assume archived/deleted if not in API
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        metaLeads: 0,
        children: [],
      });
    }
    const camp = hierarchyMap.get(row.campaignId)!;

    // AdSet
    let adSet = camp.children?.find((c) => c.id === row.adsetId);
    if (!adSet) {
      adSet = {
        id: row.adsetId,
        name: row.adsetName,
        type: 'adset',
        status: 'completed',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        metaLeads: 0,
        children: [],
      };
      if (!camp.children) camp.children = [];
      camp.children.push(adSet);
    }

    // Ad
    let ad = adSet.children?.find((c) => c.id === row.adId);
    if (!ad) {
      ad = {
        id: row.adId,
        name: row.adName,
        type: 'ad',
        status: 'completed',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        metaLeads: 0,
      };
      if (!adSet.children) adSet.children = [];
      adSet.children.push(ad);
    }
  }

  // 4. Map Metrics to Hierarchy
  const applyMetrics = (node: CampaignHierarchy) => {
    const raw = rawDataMap.get(node.id);
    if (raw) {
      const stageValues = journeyMap.map((metric) => calculateMetric(metric, raw));
      node.data.stage1 = stageValues[0] || 0;
      node.data.stage2 = stageValues[1] || 0;
      node.data.stage3 = stageValues[2] || 0;
      node.data.stage4 = stageValues[3] || 0;
      node.data.stage5 = stageValues[4] || 0;

      node.spend = raw.spend;

      // Last configured stage is the "Result"
      const resultMetric = journeyMap[journeyMap.length - 1];
      node.metaLeads = calculateMetric(resultMetric, raw);
    }

    if (node.children) {
      node.children.forEach(applyMetrics);
    }
  };

  hierarchyMap.forEach((camp) => applyMetrics(camp));

  return Array.from(hierarchyMap.values());
}
