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
        let kommoDailyMap: Record<string, { leads: number, revenue: number, sales: number }> = {};

        if (dataSource.includes('KOMMO') || dataSource.includes('HYBRID')) {
            const config = await prisma.integrationConfig.findFirst({
                where: { clientId, provider: "KOMMO", isActive: true },
            });

            if (config && config.config) {
                const { subdomain } = config.config as any;
                const journeyMap = (config.journeyMap as string[]) || [];

                // Limit concurrency to avoid rate limits
                const fetchDay = async (date: Date) => {
                    // We need exact start/end of day logic
                    const from = startOfDay(date);
                    const to = endOfDay(date);

                    try {
                        const campaigns = await fetchKommoData(subdomain, journeyMap, { from, to });

                        // Aggregate
                        let totalLeads = 0;
                        let totalRevenue = 0;
                        let totalSales = 0;

                        campaigns.forEach(c => {
                            totalLeads += c.data.stage1 || 0; // Assuming stage1 is Lead
                            totalRevenue += c.revenue || 0;
                            totalSales += c.data.stage5 || 0; // Assuming stage5 is Sale
                        });

                        return {
                            dateStr: format(date, 'yyyy-MM-dd'),
                            leads: totalLeads,
                            revenue: totalRevenue,
                            sales: totalSales
                        };
                    } catch (e) {
                        console.error(`Error fetching Kommo for ${date}:`, e);
                        return { dateStr: format(date, 'yyyy-MM-dd'), leads: 0, revenue: 0, sales: 0 };
                    }
                };

                // Run in batches of 5
                const batchSize = 5;
                const results = [];
                for (let i = 0; i < dates.length; i += batchSize) {
                    const batch = dates.slice(i, i + batchSize);
                    const batchRes = await Promise.all(batch.map(d => fetchDay(d.date)));
                    results.push(...batchRes);
                }

                results.forEach(r => {
                    kommoDailyMap[r.dateStr] = { leads: r.leads || 0, revenue: r.revenue || 0, sales: r.sales || 0 };
                });
            }
        }

        // 3. Merge
        const evolutionData = dates.map(d => {
            const dateStr = d.iso;
            const dayMeta = metaDaily.find(m => format(m.date, 'yyyy-MM-dd') === dateStr);
            const dayGoogle = googleDaily.find(g => format(g.date, 'yyyy-MM-dd') === dateStr);
            const dayKommo = kommoDailyMap[dateStr] || { leads: 0, revenue: 0, sales: 0 };

            const totalSpend = (dayMeta?._sum.spend || 0) + (dayGoogle?._sum.cost || 0);
            const metaLeads = (dayMeta?._sum.leads || 0); // Pixel leads

            // Priority: Kommo Leads > Meta Leads (if Kommo active)
            // Actually user wants "Real Data", so Kommo is source of truth for Leads/Sales if available
            const hasKommo = dataSource.includes('KOMMO') || dataSource.includes('HYBRID');

            const finalLeads = hasKommo ? dayKommo.leads : metaLeads;
            const finalRevenue = hasKommo ? dayKommo.revenue : 0; // Pixel revenue not trusted?

            // Calculate ROAS
            const roas = totalSpend > 0 ? finalRevenue / totalSpend : 0;

            return {
                date: d.label,
                leads: finalLeads,
                revenue: finalRevenue,
                receive: finalRevenue, // Mapping to chart expectation
                spend: totalSpend,
                roas: roas,
                sales: dayKommo.sales
            };
        });

        return NextResponse.json(evolutionData);

    } catch (error: any) {
        console.error("Evolution Data Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
