import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncMetaInsightsDaily } from "@/lib/meta/syncInsightsDaily";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ adAccountId: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const clientId = session.user.clientId;
    const { adAccountId } = await params;

    const body = await req.json().catch(() => ({}));
    const since = body.since || "2024-01-01";
    const until = body.until || "2024-01-31";

    const metaAccount = await prisma.metaAdAccount.findFirst({
        where: { clientId, adAccountId },
    });

    if (!metaAccount) {
        return NextResponse.json(
            { error: "Conta de anúncios não encontrada para este cliente" },
            { status: 404 }
        );
    }

    if (metaAccount.status.toLowerCase() !== "active") {
        return NextResponse.json(
            { error: "A conta de anúncios não está ativa." },
            { status: 400 }
        );
    }

    try {
        const result = await syncMetaInsightsDaily({
            metaAdAccountId: metaAccount.id,
            adAccountId: metaAccount.adAccountId,
            accessToken: metaAccount.accessToken,
            since,
            until,
        });

        return NextResponse.json({
            success: true,
            syncedRows: result.count,
        });
    } catch (err: any) {
        console.error("Erro ao sincronizar insights:", err);
        return NextResponse.json(
            { error: "Erro ao sincronizar insights", details: err.message },
            { status: 500 }
        );
    }
}
