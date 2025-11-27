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
            { error: "Conta não encontrada" },
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

    type Daily = {
        date: string;
        totalSpend: number;
    };

    const map = new Map<string, Daily>();

    for (const row of rows) {
        const dateStr = row.date.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const existing = map.get(dateStr);
        if (!existing) {
            map.set(dateStr, { date: dateStr, totalSpend: row.spend });
        } else {
            existing.totalSpend += row.spend;
        }
    }

    return NextResponse.json({
        days: Array.from(map.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        ),
    });
}
