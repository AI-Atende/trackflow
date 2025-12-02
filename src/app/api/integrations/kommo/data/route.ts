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

    const sinceLocal = searchParams.get("sinceLocal");
    const untilLocal = searchParams.get("untilLocal");

    // 2. Buscar dados do Meta (se houver conta vinculada)
    let metaCampaigns: any[] = [];
    if (adAccountId && since && until) {
      try {
        const sinceDate = new Date(since);
        const untilDate = new Date(until);

        // Meta service expects yyyy-MM-dd
        // Use provided local dates if available to avoid timezone shifts
        const metaSince = sinceLocal || sinceDate.toISOString().split('T')[0];
        const metaUntil = untilLocal || untilDate.toISOString().split('T')[0];

        metaCampaigns = await fetchMetaCampaigns(adAccountId, metaSince, metaUntil);
      } catch (err) {
        console.error("Erro ao buscar dados do Meta para fusão:", err);
      }
    }

    // 3. Mesclar dados (Left Join: Kommo <- Meta)
    const usedMetaIds = new Set<string>();

    const enrichedCampaigns = kommoCampaigns.map(kCamp => {
      // Normalizar nomes para comparação (remover espaços extras, lowercase)
      const kName = kCamp.name.trim().toLowerCase();

      // Encontrar correspondência exata que ainda não foi usada
      let match = metaCampaigns.find((mCamp: any) => {
        if (usedMetaIds.has(mCamp.id)) return false;
        return mCamp.name.trim().toLowerCase() === kName;
      });

      // Se não houver correspondência exata, tentar "Smart Match" (contém)
      if (!match) {
        match = metaCampaigns.find((mCamp: any) => {
          if (usedMetaIds.has(mCamp.id)) return false;
          const mName = mCamp.name.trim().toLowerCase();
          return kName.includes(mName) || mName.includes(kName);
        });
      }

      if (match) {
        usedMetaIds.add(match.id);
      }

      const spend = match ? match.spend : 0;
      const metaLeads = match ? match.metaLeads : 0;

      // Calcular Receita Total do Kommo (assumindo stage5 como venda/receita ou somando revenue se tivéssemos)
      // O serviço kommoService atual não retorna 'revenue' explícito no objeto AdCampaign, 
      // mas o frontend calcula como stage5 * 100. Vamos tentar manter a lógica do frontend ou melhorar o serviço.
      // Por enquanto, vamos passar o spend. O ROAS será calculado no frontend ou aqui se tivermos a receita.
      // Como AdCampaign tem campos opcionais spend e roas (verificaremos types.ts), vamos preenchê-los.

      return {
        ...kCamp,
        spend: spend,
        metaLeads: metaLeads,
        roas: 0 // O cálculo do ROAS depende da receita, que é calculada dinamicamente no frontend. Deixaremos 0 aqui.
      };
    });

    return NextResponse.json({ campaigns: enrichedCampaigns });
  } catch (error) {
    console.error("Erro ao buscar dados do Kommo:", error);
    return NextResponse.json({ error: "Erro ao buscar dados externos" }, { status: 500 });
  }
}
