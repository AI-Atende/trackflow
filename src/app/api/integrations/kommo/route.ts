import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const clientId = session.user.clientId;
  const body = await req.json();
  const { subdomain, journeyMap, isActive } = body;

  try {
    // Verificar se já existe config
    const existingConfig = await prisma.integrationConfig.findFirst({
      where: { clientId, provider: "KOMMO" },
    });

    if (existingConfig) {
      const updated = await prisma.integrationConfig.update({
        where: { id: existingConfig.id },
        data: {
          isActive,
          config: { subdomain },
          journeyMap,
        },
      });
      return NextResponse.json(updated);
    } else {
      const created = await prisma.integrationConfig.create({
        data: {
          clientId,
          provider: "KOMMO",
          isActive,
          config: { subdomain },
          journeyMap,
        },
      });
      return NextResponse.json(created);
    }
  } catch (error) {
    console.error("Erro ao salvar configuração Kommo:", error);
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const clientId = session.user.clientId;

  try {
    const config = await prisma.integrationConfig.findFirst({
      where: { clientId, provider: "KOMMO" },
    });

    return NextResponse.json(config || { isActive: false, config: {}, journeyMap: [] });
  } catch (error) {
    console.error("Erro ao buscar configuração Kommo:", error);
    return NextResponse.json({ error: "Erro ao buscar configuração" }, { status: 500 });
  }
}
