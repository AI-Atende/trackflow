import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const clientId = session.user.clientId;

  try {
    const config = await prisma.integrationConfig.findFirst({
      where: { clientId, provider: "META" },
    });

    if (!config) {
      // Return default config if none exists
      return NextResponse.json({
        journeyMap: ['impressions', 'clicks', 'leads']
      });
    }

    return NextResponse.json({
      journeyMap: config.journeyMap
    });
  } catch (error) {
    console.error("Erro ao buscar configuração do Meta:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const clientId = session.user.clientId;

  try {
    const body = await req.json();
    const { journeyMap } = body;

    if (!journeyMap || !Array.isArray(journeyMap)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Upsert configuration
    const config = await prisma.integrationConfig.findFirst({
      where: { clientId, provider: "META" },
    });

    if (config) {
      await prisma.integrationConfig.update({
        where: { id: config.id },
        data: { journeyMap },
      });
    } else {
      await prisma.integrationConfig.create({
        data: {
          clientId,
          provider: "META",
          isActive: true, // Always active for Meta in this context
          journeyMap,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar configuração do Meta:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
