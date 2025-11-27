import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ adAccountId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const clientId = session.user.clientId;
    const { adAccountId } = await params;

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since") || "2024-01-01";
    const until = searchParams.get("until") || "2024-01-31";

    const metaAccount = await prisma.metaAdAccount.findFirst({
        where: { clientId, adAccountId },
    });

    if (!metaAccount) {
        return NextResponse.json(
            { error: "Conta não encontrada para este cliente" },
            { status: 404 }
        );
    }

    if (metaAccount.status.toLowerCase() !== "active") {
        return NextResponse.json(
            { error: "A conta de anúncios não está ativa." },
            { status: 400 }
        );
    }

    const sinceDate = new Date(`${since}T00:00:00.000Z`);
    const untilDate = new Date(`${until}T23:59:59.999Z`);

    const rows = await prisma.metaAdInsightDaily.findMany({
        where: {
            metaAdAccountId: metaAccount.id,
            date: { gte: sinceDate, lte: untilDate },
        },
    });

    type AdSummary = {
        adId: string;
        adName: string;
        campaignId: string;
        campaignName: string;
        totalSpend: number;
        totalImpressions: number;
        totalClicks: number;
        totalLeads: number;
    };

    const map = new Map<string, AdSummary>();

    for (const row of rows) {
        const key = row.adId;
        const existing = map.get(key);
        if (!existing) {
            map.set(key, {
                adId: row.adId,
                adName: row.adName,
                campaignId: row.campaignId,
                campaignName: row.campaignName,
                totalSpend: row.spend,
                totalImpressions: row.impressions,
                totalClicks: row.clicks,
                totalLeads: row.leads,
            });
        } else {
            existing.totalSpend += row.spend;
            existing.totalImpressions += row.impressions;
            existing.totalClicks += row.clicks;
            existing.totalLeads += row.leads;
        }
    }

    return NextResponse.json({
        ads: Array.from(map.values()),
    });
}
