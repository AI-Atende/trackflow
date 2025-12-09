import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, columns, isDefault } = body;

    const view = await prisma.tableView.findUnique({
      where: { id },
    });

    if (!view || view.clientId !== session.user.clientId) {
      return NextResponse.json({ error: "View não encontrada" }, { status: 404 });
    }

    // If setting as default, unset others
    if (isDefault) {
      await prisma.tableView.updateMany({
        where: {
          clientId: session.user.clientId,
          dataSource: view.dataSource,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    const updatedView = await prisma.tableView.update({
      where: { id },
      data: {
        name: name || undefined,
        columns: columns || undefined,
        isDefault: isDefault !== undefined ? isDefault : undefined
      }
    });

    return NextResponse.json(updatedView);
  } catch (error) {
    console.error("Erro ao atualizar view:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const view = await prisma.tableView.findUnique({
      where: { id },
    });

    if (!view || view.clientId !== session.user.clientId) {
      return NextResponse.json({ error: "View não encontrada" }, { status: 404 });
    }

    await prisma.tableView.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar view:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
