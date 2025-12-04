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

    const normalizeString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

    const enrichedCampaigns = kommoCampaigns.map(kCamp => {
      // Normalizar nomes para comparação (remover tudo que não for alfanumérico)
      const kNameClean = normalizeString(kCamp.name);

      // Encontrar TODAS as correspondências exatas (pelo nome limpo) que ainda não foram usadas
      let matches = metaCampaigns.filter((mCamp: any) => {
        if (usedMetaIds.has(mCamp.id)) return false;
        return normalizeString(mCamp.name) === kNameClean;
      });

      // Se não houver correspondência exata, tentar "Smart Match" (contém) com nome limpo
      if (matches.length === 0) {
        matches = metaCampaigns.filter((mCamp: any) => {
          if (usedMetaIds.has(mCamp.id)) return false;
          const mNameClean = normalizeString(mCamp.name);
          return kNameClean.includes(mNameClean) || mNameClean.includes(kNameClean);
        });
      }

      if (matches.length > 0) {
        matches.forEach((m: any) => usedMetaIds.add(m.id));
      }

      // Somar métricas de todas as campanhas encontradas (se houver)
      const spend = matches.reduce((sum: number, m: any) => sum + (m.spend || 0), 0);
      const metaLeads = matches.reduce((sum: number, m: any) => sum + (m.metaLeads || 0), 0);

      return {
        ...kCamp,
        spend: spend,
        metaLeads: metaLeads,
        roas: 0 // O cálculo do ROAS depende da receita, que é calculada dinamicamente no frontend.
      };
    });

    // 4. Identificar e adicionar "Orfãos" do Meta (Full Outer Join behavior)
    const orphanMetaCampaigns = metaCampaigns.filter((mCamp: any) => !usedMetaIds.has(mCamp.id));

    const source = searchParams.get("source") || "HYBRID"; // Default to HYBRID if not specified (backward compatibility)

    let finalCampaigns = enrichedCampaigns;

    if (source === 'HYBRID') {
      const formattedOrphans = orphanMetaCampaigns.map((mCamp: any) => ({
        ...mCamp,
        status: mCamp.status as "active" | "paused" | "completed",
        isOrphan: true
      }));

      finalCampaigns = [...enrichedCampaigns, ...formattedOrphans];
    }

    return NextResponse.json({ campaigns: finalCampaigns });
  } catch (error) {
    console.error("Erro ao buscar dados do Kommo:", error);
    return NextResponse.json({ error: "Erro ao buscar dados externos" }, { status: 500 });
  }
}
