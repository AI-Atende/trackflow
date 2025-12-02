import { AdCampaign, CampaignHierarchy } from "@/types";

interface KommoResponse {
  campaigns: {
    campaign: string;
    source?: string;
    totalLeads: number;
    totalRevenue: number;
    groups: {
      medium: string;
      totalLeads: number;
      totalRevenue: number;
      ads: {
        content: string;
        leadsCount: number;
        totalRevenue: number;
        journey?: Record<string, number>;
      }[];
    }[];
  }[];
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw new Error(`Erro na requisição: ${res.status} ${res.statusText}`);
    }
    return res;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export async function fetchKommoData(
  subdomain: string,
  journeyStages: string[],
  dateRange?: { from: Date; to: Date }
): Promise<AdCampaign[]> {
  // Construir URL com parâmetros
  const url = new URL("https://aiatende.dev.br/kommo/api/kommo-leads/aggregated-utm");
  url.searchParams.set("subdomain", subdomain);

  // Adicionar estágios da jornada como repeated params
  journeyStages.forEach(stage => {
    url.searchParams.append("lead_journey", stage);
  });

  if (dateRange) {
    const fromSeconds = Math.floor(dateRange.from.getTime() / 1000);
    const toSeconds = Math.floor(dateRange.to.getTime() / 1000);

    url.searchParams.set("created_at_from", fromSeconds.toString());
    url.searchParams.set("created_at_to", toSeconds.toString());
  }

  const res = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data: KommoResponse = await res.json();

  // Adaptar para AdCampaign
  const campaigns: AdCampaign[] = [];

  data.campaigns.forEach((camp, campIndex) => {
    // Filtrar campaign desconhecida
    if (camp.campaign === 'unknown_campaign') {
      return;
    }

    // Inicializar acumuladores para a campanha
    const campaignTotals = {
      stage1: 0,
      stage2: 0,
      stage3: 0,
      stage4: 0,
      stage5: 0,
      revenue: 0
    };

    // Iterar sobre grupos e anúncios para somar
    camp.groups.forEach((group) => {
      // Filtrar medium desconhecido
      if (group.medium === 'unknown_medium') {
        return;
      }

      group.ads.forEach((ad) => {
        // Filtrar content desconhecido
        if (ad.content === 'unknown_content') {
          return;
        }

        const journeyKeys = Object.keys(ad.journey || {});

        if (journeyKeys.length === 0 && ad.leadsCount > 0) {
          // Fallback: leadsCount vai para stage1
          campaignTotals.stage1 += ad.leadsCount;
        } else {
          // Mapeamento normal
          journeyStages.slice(0, 5).forEach((stageName, idx) => {
            const key = `stage${idx + 1}` as keyof typeof campaignTotals;
            if (key !== 'revenue') {
              campaignTotals[key] += ad.journey?.[stageName] || 0;
            }
          });
        }
        // Receita separada
        campaignTotals.revenue += ad.totalRevenue || 0;
      });
    });

    // Adicionar a campanha agregada à lista
    campaigns.push({
      id: `kommo-camp-${campIndex}`,
      name: camp.campaign,
      status: "active",
      data: {
        stage1: campaignTotals.stage1,
        stage2: campaignTotals.stage2,
        stage3: campaignTotals.stage3,
        stage4: campaignTotals.stage4,
        stage5: campaignTotals.stage5,
      },
      revenue: campaignTotals.revenue
    });
  });

  return campaigns;
}

export async function fetchKommoHierarchy(
  subdomain: string,
  journeyStages: string[],
  dateRange?: { from: Date; to: Date }
): Promise<CampaignHierarchy[]> {
  const url = new URL("https://aiatende.dev.br/kommo/api/kommo-leads/aggregated-utm");
  url.searchParams.set("subdomain", subdomain);
  journeyStages.forEach(stage => url.searchParams.append("lead_journey", stage));

  if (dateRange) {
    const fromSeconds = Math.floor(dateRange.from.getTime() / 1000);
    const toSeconds = Math.floor(dateRange.to.getTime() / 1000);
    url.searchParams.set("created_at_from", fromSeconds.toString());
    url.searchParams.set("created_at_to", toSeconds.toString());
  }

  const res = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data: KommoResponse = await res.json();
  const hierarchy: CampaignHierarchy[] = [];

  data.campaigns.forEach((camp, campIndex) => {
    // Filtrar campaign desconhecida
    if (camp.campaign === 'unknown_campaign') {
      return;
    }

    const campaignNode: CampaignHierarchy = {
      id: `kommo-camp-${campIndex}`,
      name: camp.campaign,
      type: 'campaign',
      status: 'active',
      data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
      spend: 0,
      roas: 0,
      revenue: 0,
      children: []
    };

    camp.groups.forEach((group, groupIndex) => {
      // Filtrar medium desconhecido
      if (group.medium === 'unknown_medium') {
        return;
      }

      const adSetNode: CampaignHierarchy = {
        id: `kommo-adset-${campIndex}-${groupIndex}`,
        name: group.medium || "Sem Grupo",
        type: 'adset',
        status: 'active',
        data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
        spend: 0,
        roas: 0,
        revenue: 0,
        children: []
      };

      group.ads.forEach((ad, adIndex) => {
        // Filtrar content desconhecido
        if (ad.content === 'unknown_content') {
          return;
        }

        const adNode: CampaignHierarchy = {
          id: `kommo-ad-${campIndex}-${groupIndex}-${adIndex}`,
          name: ad.content || "Anúncio Sem Nome",
          type: 'ad',
          status: 'active',
          data: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 },
          spend: 0,
          roas: 0,
          revenue: 0
        };

        // Calcular métricas do anúncio
        const journeyKeys = Object.keys(ad.journey || {});
        if (journeyKeys.length === 0 && ad.leadsCount > 0) {
          adNode.data.stage1 = ad.leadsCount;
        } else {
          journeyStages.slice(0, 5).forEach((stageName, idx) => {
            const key = `stage${idx + 1}` as keyof typeof adNode.data;
            adNode.data[key] = ad.journey?.[stageName] || 0;
          });
        }
        // Receita do anúncio (totalRevenue)
        adNode.revenue = ad.totalRevenue || 0;

        // Somar ao AdSet
        adSetNode.data.stage1 += adNode.data.stage1;
        adSetNode.data.stage2 += adNode.data.stage2;
        adSetNode.data.stage3 += adNode.data.stage3;
        adSetNode.data.stage4 += adNode.data.stage4;
        adSetNode.data.stage5 += adNode.data.stage5;
        adSetNode.revenue += adNode.revenue;

        adSetNode.children?.push(adNode);
      });

      // Somar à Campanha
      campaignNode.data.stage1 += adSetNode.data.stage1;
      campaignNode.data.stage2 += adSetNode.data.stage2;
      campaignNode.data.stage3 += adSetNode.data.stage3;
      campaignNode.data.stage4 += adSetNode.data.stage4;
      campaignNode.data.stage5 += adSetNode.data.stage5;
      campaignNode.revenue += adSetNode.revenue;

      campaignNode.children?.push(adSetNode);
    });

    hierarchy.push(campaignNode);
  });

  return hierarchy;
}
