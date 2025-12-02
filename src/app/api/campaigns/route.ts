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

            // Helper for smart matching
            const findMatch = (nodes: CampaignHierarchy[], target: CampaignHierarchy, usedIds: Set<string>) => {
              // 1. Exact Match
              let match = nodes.find(n => {
                if (usedIds.has(n.id)) return false;
                return n.name.trim().toLowerCase() === target.name.trim().toLowerCase();
              });

              // 2. Smart Match (Contains)
              if (!match) {
                match = nodes.find(n => {
                  if (usedIds.has(n.id)) return false;
                  const nName = n.name.trim().toLowerCase();
                  const tName = target.name.trim().toLowerCase();
                  return nName.includes(tName) || tName.includes(nName);
                });
              }

              return match;
            };

            const usedKommoIds = new Set<string>();

            metaData.forEach(mCamp => {
              const match = findMatch(campaigns, mCamp, usedKommoIds);

              if (match) {
                usedKommoIds.add(match.id);
                // Merge Campaign Metrics
                match.spend += mCamp.spend;
                match.metaLeads = mCamp.metaLeads;

                // Merge AdSets
                if (mCamp.children && mCamp.children.length > 0) {
                  if (!match.children) match.children = [];
                  const usedAdSetIds = new Set<string>();

                  mCamp.children.forEach(mAdSet => {
                    const adSetMatch = findMatch(match.children!, mAdSet, usedAdSetIds);

                    if (adSetMatch) {
                      usedAdSetIds.add(adSetMatch.id);
                      adSetMatch.spend += mAdSet.spend;
                      adSetMatch.metaLeads = mAdSet.metaLeads;

                      // Merge Ads
                      if (mAdSet.children && mAdSet.children.length > 0) {
                        if (!adSetMatch.children) adSetMatch.children = [];
                        const usedAdIds = new Set<string>();

                        mAdSet.children.forEach(mAd => {
                          const adMatch = findMatch(adSetMatch.children!, mAd, usedAdIds);

                          if (adMatch) {
                            usedAdIds.add(adMatch.id);
                            adMatch.spend += mAd.spend;
                            adMatch.metaLeads = mAd.metaLeads;
                          } else {
                            adSetMatch.children!.push(mAd);
                          }
                        });
                      }
                    } else {
                      match.children!.push(mAdSet);
                    }
                  });
                }
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
