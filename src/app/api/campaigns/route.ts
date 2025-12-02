import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchKommoHierarchy } from "@/services/kommoService";
import { fetchMetaHierarchy } from "@/services/metaService";
import { CampaignHierarchy } from "@/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "KOMMO";
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const sinceLocal = searchParams.get("sinceLocal");
  const untilLocal = searchParams.get("untilLocal");

  if (!since || !until) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  }

  try {
    let campaigns: CampaignHierarchy[] = [];

    // Fetch Kommo
    if (source === "KOMMO" || source === "HYBRID") {
      const config = await prisma.integrationConfig.findFirst({
        where: { clientId: session.user.clientId, provider: "KOMMO", isActive: true },
      });

      if (config && config.config) {
        const { subdomain } = config.config as any;
        const journeyMap = (config.journeyMap as string[]) || ["Criado", "Qualificado", "Venda"];

        const dateRange = {
          from: new Date(since),
          to: new Date(until)
        };

        try {
          const kommoData = await fetchKommoHierarchy(subdomain, journeyMap, dateRange);
          campaigns = [...campaigns, ...kommoData];
        } catch (e) {
          console.error("Erro ao buscar Kommo:", e);
        }
      }
    }

    // Fetch Meta
    if (source === "META" || source === "HYBRID") {
      if (session.user.metaAdAccount?.adAccountId) {
        try {
          // Meta service expects yyyy-MM-dd
          const sinceDate = new Date(since);
          const untilDate = new Date(until);

          // Use provided local dates if available to avoid timezone shifts
          const metaSince = sinceLocal || sinceDate.toISOString().split('T')[0];
          const metaUntil = untilLocal || untilDate.toISOString().split('T')[0];

          const metaData = await fetchMetaHierarchy(session.user.metaAdAccount.adAccountId, metaSince, metaUntil);

          if (source === "HYBRID") {
            // Merge logic: Try to match by name
            // If match found, merge data. If not, append.
            // Note: Merging hierarchies is complex. For now, we'll append and let the user see both if names differ.
            // Or we can try a simple merge on Campaign Name.

            metaData.forEach(mCamp => {
              const existing = campaigns.find(c => c.name.trim().toLowerCase() === mCamp.name.trim().toLowerCase());
              if (existing) {
                // Merge metrics
                existing.spend += mCamp.spend;
                existing.metaLeads = mCamp.metaLeads; // Assign Meta leads to existing Kommo campaign

                // Note: Stage metrics might mean different things (Kommo=CRM stages, Meta=Impressions/Clicks).
                // In Dashboard we show them side-by-side or mapped.
                // Here, we might just want to show them.
                // If we merge, we might lose the distinction.
                // Let's just append for now to be safe, or maybe prefix IDs to avoid collision if we didn't already.
                // IDs are already prefixed in Kommo service ("kommo-camp-..."). Meta IDs are raw.
              } else {
                campaigns.push(mCamp);
              }
            });
          } else {
            campaigns = metaData;
          }
        } catch (e) {
          console.error("Erro ao buscar Meta:", e);
        }
      }
    }

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Erro geral na API de campanhas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
