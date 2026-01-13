import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchKommoData } from "@/services/kommoService";
import { subDays, startOfDay, endOfDay, format } from "date-fns";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const dataSource = searchParams.get("dataSource") || "HYBRID";

    const days = parseInt(daysParam || "7", 10);
    const clientId = session.user.clientId;

    try {
        const dates = Array.from({ length: days }, (_, i) => {
            const d = subDays(new Date(), days - 1 - i);
            return {
                date: d,
                label: format(d, 'dd/MM'),
                iso: d.toISOString().split('T')[0]
            };
        });

        // 1. Fetch Meta/Google Daily Insights from DB
        // We can fetch all in one go
        const startDate = startOfDay(dates[0].date);
        const endDate = endOfDay(dates[dates.length - 1].date);

        const [metaDaily, googleDaily] = await Promise.all([
            prisma.metaAdInsightDaily.groupBy({
                by: ['date'],
                where: {
                    metaAdAccount: { clientId: clientId },
                    date: { gte: startDate, lte: endDate }
                },
                _sum: {
                    spend: true,
                    impressions: true,
                    clicks: true,
                    leads: true, // Pixel leads
                    results: true
                }
            }),
            prisma.googleAdInsightDaily.groupBy({
                by: ['date'],
                where: {
                    googleAdAccount: { clientId: clientId },
                    date: { gte: startDate, lte: endDate }
                },
                _sum: {
                    cost: true,
                    impressions: true,
                    clicks: true,
                    conversions: true
                }
            })
        ]);

        // 2. Fetch Kommo Data (Iterative)
        // Only if dataSource includes KOMMO or HYBRID
        let kommoDailyMap: Record<string, { stages: Record<string, number>, revenue: number }> = {};
        let activeJourneyMap: string[] = [];

        if (dataSource.includes('KOMMO') || dataSource.includes('HYBRID')) {
            const config = await prisma.integrationConfig.findFirst({
                where: { clientId, provider: "KOMMO", isActive: true },
            });

            if (config && config.config) {
                const { subdomain } = config.config as any;
                activeJourneyMap = (config.journeyMap as string[]) || ["Leads", "Vendas"];

                const fetchDay = async (date: Date) => {
                    const from = startOfDay(date);
                    const to = endOfDay(date);
                    const isoStr = format(date, 'yyyy-MM-dd');

                    try {
                        const campaigns = await fetchKommoData(subdomain, activeJourneyMap, { from, to });

                        // Aggregate by journey map index
                        let stageTotals: Record<string, number> = {};
                        activeJourneyMap.forEach(name => stageTotals[name] = 0);

                        let totalRevenue = 0;

                        campaigns.forEach(c => {
                            activeJourneyMap.forEach((name, idx) => {
                                const stageKey = `stage${idx + 1}` as keyof typeof c.data;
                                stageTotals[name] += (c.data[stageKey] || 0) as number;
                            });
                            totalRevenue += c.revenue || 0;
                        });

                        return {
                            dateStr: isoStr,
                            stages: stageTotals,
                            revenue: totalRevenue
                        };
                    } catch (e: any) {
                        const isAuthError = e.message?.includes("KOMMO_AUTH_ERROR");
                        if (isAuthError) {
                            console.error(`[KOMMO AUTH FAIL] ${isoStr}: Token expirado ou inválido.`);
                        } else {
                            console.error(`Error fetching Kommo for ${date}:`, e);
                        }

                        let emptyStages: Record<string, number> = {};
                        activeJourneyMap.forEach(name => emptyStages[name] = 0);

                        return { dateStr: isoStr, stages: emptyStages, revenue: 0 };
                    }
                };

                const batchSize = 2;
                const results = [];
                for (let i = 0; i < dates.length; i += batchSize) {
                    const batch = dates.slice(i, i + batchSize);
                    const batchRes = await Promise.all(batch.map(d => fetchDay(d.date)));
                    results.push(...batchRes);
                }

                results.forEach(r => {
                    kommoDailyMap[r.dateStr] = {
                        stages: r.stages,
                        revenue: r.revenue || 0
                    };
                });
            }
        }

        // 3. Merge
        const evolutionData = dates.map(d => {
            const dateStr = d.iso;
            const dayMeta = metaDaily.find(m => format(m.date, 'yyyy-MM-dd') === dateStr);
            const dayGoogle = googleDaily.find(g => format(g.date, 'yyyy-MM-dd') === dateStr);

            let emptyStages: Record<string, number> = {};
            activeJourneyMap.forEach(name => emptyStages[name] = 0);

            const dayKommo = kommoDailyMap[dateStr] || { stages: emptyStages, revenue: 0 };

            const totalSpend = (dayMeta?._sum.spend || 0) + (dayGoogle?._sum.cost || 0);
            const metaLeads = (dayMeta?._sum.leads || 0);

            const hasKommo = (dataSource.includes('KOMMO') || dataSource.includes('HYBRID')) && activeJourneyMap.length > 0;
            const finalRevenue = hasKommo ? dayKommo.revenue : 0;
            const roas = totalSpend > 0 ? finalRevenue / totalSpend : 0;

            // Base object
            const result: any = {
                date: d.label,
                revenue: finalRevenue,
                receive: finalRevenue,
                spend: totalSpend,
                roas: roas,
            };

            // Add dynamic stages
            activeJourneyMap.forEach((name, idx) => {
                let value = dayKommo.stages[name] || 0;

                // Fallback for Leads if Kommo is not present but Meta is
                if (idx === 0 && !hasKommo) {
                    value = metaLeads;
                }

                result[name] = value;
            });

            return result;
        });

        return NextResponse.json({
            data: evolutionData,
            journeyMap: activeJourneyMap
        });

    } catch (error: any) {
        console.error("Evolution Data Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
