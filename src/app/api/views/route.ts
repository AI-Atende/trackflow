import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dataSource = searchParams.get("dataSource");

  if (!dataSource) {
    return NextResponse.json({ error: "DataSource é obrigatório" }, { status: 400 });
  }

  try {
    const views = await prisma.tableView.findMany({
      where: {
        clientId: session.user.clientId,
        dataSource,
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(views);
  } catch (error) {
    console.error("Erro ao buscar views:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, dataSource, columns, isDefault } = body;

    if (!name || !dataSource || !columns) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // If setting as default, unset others
    if (isDefault) {
      await prisma.tableView.updateMany({
        where: { clientId: session.user.clientId, dataSource },
        data: { isDefault: false }
      });
    }

    const view = await prisma.tableView.create({
      data: {
        clientId: session.user.clientId,
        name,
        dataSource,
        columns,
        isDefault: isDefault || false
      }
    });

    return NextResponse.json(view);
  } catch (error) {
    console.error("Erro ao criar view:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
