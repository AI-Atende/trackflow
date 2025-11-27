import { AdCampaign } from "@/types";

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
    // A API do Kommo (conforme documentação) não especificou filtro de data na query,
    // mas vamos assumir que pode ser implementado ou filtrado no backend.
    // Se a API não suportar, teremos que filtrar no retorno (o que é ineficiente para grandes volumes).
    // Por enquanto, vamos enviar para caso a API suporte no futuro ou ignorar.
    // url.searchParams.set("since", ...); 
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Erro ao buscar dados do Kommo: ${res.statusText}`);
  }

  const data: KommoResponse = await res.json();

  // Adaptar para AdCampaign
  const campaigns: AdCampaign[] = [];

  data.campaigns.forEach((camp, campIndex) => {
    // Inicializar acumuladores para a campanha
    const campaignTotals = {
      stage1: 0,
      stage2: 0,
      stage3: 0,
      stage4: 0,
      stage5: 0
    };

    // Iterar sobre grupos e anúncios para somar
    camp.groups.forEach((group) => {
      group.ads.forEach((ad) => {
        const journeyKeys = Object.keys(ad.journey || {});

        if (journeyKeys.length === 0 && ad.leadsCount > 0) {
          // Fallback: leadsCount vai para stage1
          campaignTotals.stage1 += ad.leadsCount;
        } else {
          // Mapeamento normal
          journeyStages.slice(0, 5).forEach((stageName, idx) => {
            const key = `stage${idx + 1}` as keyof typeof campaignTotals;
            campaignTotals[key] += ad.journey?.[stageName] || 0;
          });
        }
      });
    });

    // Adicionar a campanha agregada à lista
    campaigns.push({
      id: `kommo-camp-${campIndex}`,
      name: camp.campaign, // Nome limpo da campanha
      status: "active",
      data: {
        stage1: campaignTotals.stage1,
        stage2: campaignTotals.stage2,
        stage3: campaignTotals.stage3,
        stage4: campaignTotals.stage4,
        stage5: campaignTotals.stage5,
      },
      // Preservar estrutura original em uma propriedade extra se necessário no futuro
      // (Opcional, mas como a interface AdCampaign é estrita, não vamos adicionar agora para evitar erros de TS)
    });
  });

  return campaigns;
}
