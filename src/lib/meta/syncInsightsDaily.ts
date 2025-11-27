import { prisma } from "@/lib/prisma";
import { metaGet } from "./client";
import type { RawInsightsResponse } from "./types";
import { extractLeadsFromActions } from "./insights";

export async function syncMetaInsightsDaily(options: {
    metaAdAccountId: string;
    adAccountId: string;
    accessToken: string;
    since: string; // "YYYY-MM-DD"
    until: string; // "YYYY-MM-DD"
}) {
    const { metaAdAccountId, adAccountId, accessToken, since, until } = options;

    // Garantir prefixo act_ para chamadas de API de anúncios
    const apiAdAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    const insights = await metaGet<RawInsightsResponse>(
        `/${apiAdAccountId}/insights`,
        accessToken,
        {
            level: "ad",
            time_range: JSON.stringify({ since, until }),
            time_increment: 1,
            fields: [
                "date_start",
                "date_stop",
                "campaign_id",
                "campaign_name",
                "adset_id",
                "adset_name",
                "ad_id",
                "ad_name",
                "impressions",
                "clicks",
                "spend",
                "actions",
            ].join(","),
            limit: 1000,
        }
    );

    const rows = insights.data || [];

    for (const row of rows) {
        const dateStr = row.date_start;
        const date = new Date(`${dateStr}T00:00:00.000Z`);

        const leads = extractLeadsFromActions(row.actions);

        await prisma.metaAdInsightDaily.upsert({
            where: {
                metaAdAccountId_adId_date: {
                    metaAdAccountId,
                    adId: row.ad_id,
                    date,
                },
            },
            update: {
                campaignId: row.campaign_id,
                campaignName: row.campaign_name,
                adsetId: row.adset_id,
                adsetName: row.adset_name,
                adName: row.ad_name,
                impressions: Number(row.impressions || 0),
                clicks: Number(row.clicks || 0),
                spend: Number(row.spend || 0),
                leads,
            },
            create: {
                metaAdAccountId,
                date,
                campaignId: row.campaign_id,
                campaignName: row.campaign_name,
                adsetId: row.adset_id,
                adsetName: row.adset_name,
                adId: row.ad_id,
                adName: row.ad_name,
                impressions: Number(row.impressions || 0),
                clicks: Number(row.clicks || 0),
                spend: Number(row.spend || 0),
                leads,
            },
        });
    }

    return { count: rows.length };
}
