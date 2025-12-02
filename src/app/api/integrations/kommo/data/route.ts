import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchKommoData } from "@/services/kommoService";
import { fetchMetaCampaigns } from "@/services/metaService";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const clientId = session.user.clientId;
  const adAccountId = session.user.metaAdAccount?.adAccountId;

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");

  try {
    const config = await prisma.integrationConfig.findFirst({
      where: { clientId, provider: "KOMMO", isActive: true },
    });

    if (!config || !config.config) {
      return NextResponse.json({ error: "Integração Kommo não ativa ou não configurada" }, { status: 400 });
    }

    const { subdomain } = config.config as any;
    const journeyMap = (config.journeyMap as string[]) || ["Criado", "Qualificado", "Venda"];

    const dateRange = since && until ? {
      from: new Date(since),
      to: new Date(until)
    } : undefined;

    // 1. Buscar dados do Kommo
    const kommoCampaigns = await fetchKommoData(subdomain, journeyMap, dateRange);

    // 2. Buscar dados do Meta (se houver conta vinculada)
    let metaCampaigns: any[] = [];
    if (adAccountId && since && until) {
      try {
        const sinceDate = new Date(since);
        const untilDate = new Date(until);
        // Meta service expects yyyy-MM-dd
        const sinceStr = sinceDate.toISOString().split('T')[0];
        const untilStr = untilDate.toISOString().split('T')[0];

        metaCampaigns = await fetchMetaCampaigns(adAccountId, sinceStr, untilStr);
      } catch (err) {
        console.error("Erro ao buscar dados do Meta para fusão:", err);
      }
    }

    // 3. Mesclar dados (Left Join: Kommo <- Meta)
    const enrichedCampaigns = kommoCampaigns.map(kCamp => {
      // Normalizar nomes para comparação (remover espaços extras, lowercase)
      const kName = kCamp.name.trim().toLowerCase();

      // Tentar encontrar correspondência exata ou parcial
      const match = metaCampaigns.find((mCamp: any) =>
        mCamp.campaignName.trim().toLowerCase() === kName ||
        kName.includes(mCamp.campaignName.trim().toLowerCase()) ||
        mCamp.campaignName.trim().toLowerCase().includes(kName)
      );

      const spend = match ? match.totalSpend : 0;

      // Calcular Receita Total do Kommo (assumindo stage5 como venda/receita ou somando revenue se tivéssemos)
      // O serviço kommoService atual não retorna 'revenue' explícito no objeto AdCampaign, 
      // mas o frontend calcula como stage5 * 100. Vamos tentar manter a lógica do frontend ou melhorar o serviço.
      // Por enquanto, vamos passar o spend. O ROAS será calculado no frontend ou aqui se tivermos a receita.
      // Como AdCampaign tem campos opcionais spend e roas (verificaremos types.ts), vamos preenchê-los.

      return {
        ...kCamp,
        spend: spend,
        roas: 0 // O cálculo do ROAS depende da receita, que é calculada dinamicamente no frontend. Deixaremos 0 aqui.
      };
    });

    return NextResponse.json({ campaigns: enrichedCampaigns });
  } catch (error) {
    console.error("Erro ao buscar dados do Kommo:", error);
    return NextResponse.json({ error: "Erro ao buscar dados externos" }, { status: 500 });
  }
}
