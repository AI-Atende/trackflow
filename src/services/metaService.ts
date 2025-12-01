import { prisma } from "@/lib/prisma";

export async function fetchMetaCampaigns(adAccountId: string, since: string, until: string) {
  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { adAccountId },
  });

  if (!metaAccount) {
    return [];
  }

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

  return Array.from(map.values());
}

import { CampaignHierarchy } from "@/types";

export async function fetchMetaHierarchy(adAccountId: string, since: string, until: string): Promise<CampaignHierarchy[]> {
  const metaAccount = await prisma.metaAdAccount.findFirst({
    where: { adAccountId },
  });

  if (!metaAccount) {
    return [];
  }

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

  // Map<CampaignId, CampaignNode>
  const campaignsMap = new Map<string, CampaignHierarchy>();
  // Map<AdSetId, AdSetNode>
  const adSetsMap = new Map<string, CampaignHierarchy>();
  // Map<AdId, AdNode>
  const adsMap = new Map<string, CampaignHierarchy>();

  // Primeiro passo: Agregar dados por nível
  for (const row of rows) {
    // 1. Campaign Level
    if (!campaignsMap.has(row.campaignId)) {
      campaignsMap.set(row.campaignId, {
        id: row.campaignId,
        name: row.campaignName,
        type: 'campaign',
        status: 'active',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        children: []
      });
    }
    const camp = campaignsMap.get(row.campaignId)!;
    camp.spend += row.spend;
    camp.data.stage1 += row.impressions;
    camp.data.stage2 += row.clicks;
    camp.data.stage3 += row.leads;

    // 2. AdSet Level
    if (!adSetsMap.has(row.adsetId)) {
      const adSetNode: CampaignHierarchy = {
        id: row.adsetId,
        name: row.adsetName,
        type: 'adset',
        status: 'active',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        children: []
      };
      adSetsMap.set(row.adsetId, adSetNode);
      // Link AdSet to Campaign immediately if not already linked? 
      // Better to link after aggregation to avoid duplicates in children array.
    }
    const adSet = adSetsMap.get(row.adsetId)!;
    adSet.spend += row.spend;
    adSet.data.stage1 += row.impressions;
    adSet.data.stage2 += row.clicks;
    adSet.data.stage3 += row.leads;

    // 3. Ad Level
    if (!adsMap.has(row.adId)) {
      const adNode: CampaignHierarchy = {
        id: row.adId,
        name: row.adName,
        type: 'ad',
        status: 'active',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0
      };
      adsMap.set(row.adId, adNode);
    }
    const ad = adsMap.get(row.adId)!;
    ad.spend += row.spend;
    ad.data.stage1 += row.impressions;
    ad.data.stage2 += row.clicks;
    ad.data.stage3 += row.leads;
  }

  // Segundo passo: Construir a árvore
  // Precisamos saber qual AdSet pertence a qual Campaign e qual Ad pertence a qual AdSet.
  // Como iteramos sobre rows, podemos ter perdido essa relação se fizermos maps separados.
  // Vamos re-iterar ou armazenar a relação parent-child nos maps?
  // Melhor abordagem: Construir a árvore diretamente no loop ou usar um map auxiliar de relacionamentos.

  // Vamos refazer a lógica para garantir a hierarquia correta.

  const hierarchyMap = new Map<string, CampaignHierarchy>(); // CampaignId -> CampaignNode

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
        children: []
      });
    }
    const campaign = hierarchyMap.get(row.campaignId)!;
    campaign.spend += row.spend;
    campaign.data.stage1 += row.impressions;
    campaign.data.stage2 += row.clicks;
    campaign.data.stage3 += row.leads;

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
        children: []
      };
      campaign.children?.push(adSet);
    }
    adSet.spend += row.spend;
    adSet.data.stage1 += row.impressions;
    adSet.data.stage2 += row.clicks;
    adSet.data.stage3 += row.leads;

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
        revenue: 0
      };
      adSet.children?.push(ad);
    }
    ad.spend += row.spend;
    ad.data.stage1 += row.impressions;
    ad.data.stage2 += row.clicks;
    ad.data.stage3 += row.leads;
  }

  return Array.from(hierarchyMap.values());
}
