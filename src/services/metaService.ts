import { prisma } from "@/lib/prisma";

export async function fetchMetaCampaigns(adAccountId: string, since: string, until: string) {
  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { adAccountId },
    include: { client: { include: { integrations: true } } }
  });

  if (!metaAccount) {
    return [];
  }

  // Get Meta Config
  const metaConfig = metaAccount.client.integrations.find(i => i.provider === 'META');
  const journeyMap = (metaConfig?.journeyMap as string[]) || ['impressions', 'clicks', 'leads'];

  const sinceDate = new Date(`${since}T00:00:00.000Z`);
  const untilDate = new Date(`${until}T23:59:59.999Z`);

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
      });
    } else {
      existing.totalSpend += row.spend;
      existing.totalImpressions += row.impressions;
      existing.totalClicks += row.clicks;
      existing.totalLeads += row.leads;
    }
  }

  const calculateMetric = (metric: string, data: CampaignSummary) => {
    switch (metric) {
      case 'impressions': return data.totalImpressions;
      case 'clicks': return data.totalClicks;
      case 'leads': return data.totalLeads;
      case 'spend': return data.totalSpend;
      case 'ctr': return data.totalImpressions > 0 ? (data.totalClicks / data.totalImpressions) * 100 : 0;
      case 'cpc': return data.totalClicks > 0 ? data.totalSpend / data.totalClicks : 0;
      case 'cpm': return data.totalImpressions > 0 ? (data.totalSpend / data.totalImpressions) * 1000 : 0;
      case 'cpa': return data.totalLeads > 0 ? data.totalSpend / data.totalLeads : 0;
      default: return 0;
    }
  };

  return Array.from(map.values()).map(c => {
    const stageValues = journeyMap.map(metric => calculateMetric(metric, c));

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
        stage5: stageValues[4] || 0
      },
      spend: c.totalSpend,
      roas: 0,
      revenue: 0,
      metaLeads: resultValue
    };
  });
}

import { CampaignHierarchy } from "@/types";

export async function fetchMetaHierarchy(adAccountId: string, since: string, until: string): Promise<CampaignHierarchy[]> {
  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { adAccountId },
    include: { client: { include: { integrations: true } } }
  });

  if (!metaAccount) {
    return [];
  }

  // Get Meta Config
  const metaConfig = metaAccount.client.integrations.find(i => i.provider === 'META');
  const journeyMap = (metaConfig?.journeyMap as string[]) || ['impressions', 'clicks', 'leads'];

  const sinceDate = new Date(`${since}T00:00:00.000Z`);
  const untilDate = new Date(`${until}T23:59:59.999Z`);

  const rows = await prisma.metaAdInsightDaily.findMany({
    where: {
      metaAdAccountId: metaAccount.id,
      date: {
        gte: sinceDate,
        lte: untilDate,
      },
    },
  });

  // Helper to aggregate raw data
  type AggregatedData = {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
  };

  const aggregate = (target: AggregatedData, source: AggregatedData) => {
    target.spend += source.spend;
    target.impressions += source.impressions;
    target.clicks += source.clicks;
    target.leads += source.leads;
  };

  const calculateMetric = (metric: string, data: AggregatedData) => {
    switch (metric) {
      case 'impressions': return data.impressions;
      case 'clicks': return data.clicks;
      case 'leads': return data.leads;
      case 'spend': return data.spend;
      case 'ctr': return data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
      case 'cpc': return data.clicks > 0 ? data.spend / data.clicks : 0;
      case 'cpm': return data.impressions > 0 ? (data.spend / data.impressions) * 1000 : 0;
      case 'cpa': return data.leads > 0 ? data.spend / data.leads : 0;
      default: return 0;
    }
  };

  // Temporary map to hold raw aggregated data before mapping to stages
  const rawDataMap = new Map<string, AggregatedData>();

  const getRawData = (id: string) => {
    if (!rawDataMap.has(id)) {
      rawDataMap.set(id, { spend: 0, impressions: 0, clicks: 0, leads: 0 });
    }
    return rawDataMap.get(id)!;
  };

  const hierarchyMap = new Map<string, CampaignHierarchy>();

  // 1. Build Hierarchy Structure & Aggregate Raw Data
  for (const row of rows) {
    // Campaign
    if (!hierarchyMap.has(row.campaignId)) {
      hierarchyMap.set(row.campaignId, {
        id: row.campaignId,
        name: row.campaignName,
        type: 'campaign',
        status: 'active',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        metaLeads: 0,
        children: []
      });
    }
    const campaign = hierarchyMap.get(row.campaignId)!;
    const campRaw = getRawData(row.campaignId);
    aggregate(campRaw, { spend: row.spend, impressions: row.impressions, clicks: row.clicks, leads: row.leads });

    // AdSet
    let adSet = campaign.children?.find(c => c.id === row.adsetId);
    if (!adSet) {
      adSet = {
        id: row.adsetId,
        name: row.adsetName,
        type: 'adset',
        status: 'active',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        metaLeads: 0,
        children: []
      };
      campaign.children?.push(adSet);
    }
    const adSetRaw = getRawData(row.adsetId);
    aggregate(adSetRaw, { spend: row.spend, impressions: row.impressions, clicks: row.clicks, leads: row.leads });

    // Ad
    let ad = adSet.children?.find(c => c.id === row.adId);
    if (!ad) {
      ad = {
        id: row.adId,
        name: row.adName,
        type: 'ad',
        status: 'active',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        metaLeads: 0
      };
      adSet.children?.push(ad);
    }
    const adRaw = getRawData(row.adId);
    aggregate(adRaw, { spend: row.spend, impressions: row.impressions, clicks: row.clicks, leads: row.leads });
  }

  // 2. Map Raw Data to Configured Stages
  const applyMetrics = (node: CampaignHierarchy) => {
    const raw = rawDataMap.get(node.id);
    if (raw) {
      const stageValues = journeyMap.map(metric => calculateMetric(metric, raw));
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

  hierarchyMap.forEach(camp => applyMetrics(camp));

  return Array.from(hierarchyMap.values());
}
