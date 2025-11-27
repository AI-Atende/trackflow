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
