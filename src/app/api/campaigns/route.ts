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

            const normalizeString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

            // Helper for smart matching - Returns ALL matches
            const findMatches = (nodes: CampaignHierarchy[], target: CampaignHierarchy, usedIds: Set<string>) => {
              const targetNameClean = normalizeString(target.name);

              // 1. Exact Match
              let matches = nodes.filter(n => {
                if (usedIds.has(n.id)) return false;
                return normalizeString(n.name) === targetNameClean;
              });

              // 2. Smart Match (Contains)
              if (matches.length === 0) {
                matches = nodes.filter(n => {
                  if (usedIds.has(n.id)) return false;
                  const nNameClean = normalizeString(n.name);
                  return nNameClean.includes(targetNameClean) || targetNameClean.includes(nNameClean);
                });
              }

              return matches;
            };

            const usedMetaIds = new Set<string>();
            const matchedKommoIds = new Set<string>();

            campaigns.forEach(kCamp => {
              const matches = findMatches(metaData, kCamp, usedMetaIds);

              if (matches.length > 0) {
                matchedKommoIds.add(kCamp.id);
                matches.forEach(m => usedMetaIds.add(m.id));

                // Sum metrics
                kCamp.spend = (kCamp.spend || 0) + matches.reduce((s, m) => s + m.spend, 0);
                kCamp.metaLeads = (kCamp.metaLeads || 0) + matches.reduce((s, m) => s + (m.metaLeads || 0), 0);

                // Merge Children (AdSets)
                const allMetaAdSets: CampaignHierarchy[] = [];
                matches.forEach(m => {
                  if (m.children) allMetaAdSets.push(...m.children);
                });

                if (allMetaAdSets.length > 0) {
                  if (!kCamp.children) kCamp.children = [];
                  const usedMetaAdSetIds = new Set<string>();

                  kCamp.children.forEach(kAdSet => {
                    const adSetMatches = findMatches(allMetaAdSets, kAdSet, usedMetaAdSetIds);

                    if (adSetMatches.length > 0) {
                      adSetMatches.forEach(m => usedMetaAdSetIds.add(m.id));
                      kAdSet.spend = (kAdSet.spend || 0) + adSetMatches.reduce((s, m) => s + m.spend, 0);
                      kAdSet.metaLeads = (kAdSet.metaLeads || 0) + adSetMatches.reduce((s, m) => s + (m.metaLeads || 0), 0);

                      // Merge Children (Ads)
                      const allMetaAds: CampaignHierarchy[] = [];
                      adSetMatches.forEach(m => {
                        if (m.children) allMetaAds.push(...m.children);
                      });

                      if (allMetaAds.length > 0) {
                        if (!kAdSet.children) kAdSet.children = [];
                        const usedMetaAdIds = new Set<string>();

                        kAdSet.children.forEach(kAd => {
                          const adMatches = findMatches(allMetaAds, kAd, usedMetaAdIds);

                          if (adMatches.length > 0) {
                            adMatches.forEach(m => usedMetaAdIds.add(m.id));
                            kAd.spend = (kAd.spend || 0) + adMatches.reduce((s, m) => s + m.spend, 0);
                            kAd.metaLeads = (kAd.metaLeads || 0) + adMatches.reduce((s, m) => s + (m.metaLeads || 0), 0);
                          }
                        });
                      }
                    }
                  });
                }
              }
            });

            // Filter to keep ONLY matched Kommo campaigns
            campaigns = campaigns.filter(c => matchedKommoIds.has(c.id));
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
