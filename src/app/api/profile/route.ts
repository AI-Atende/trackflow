import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const user = await prisma.client.findUnique({
        where: { id: session.user.clientId },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
        },
    });

    if (!user) {
        return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { name, image } = body;

    try {
        const updatedUser = await prisma.client.update({
            where: { id: session.user.clientId },
            data: {
                name,
                image,
            },
        });

        return NextResponse.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            image: updatedUser.image,
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Erro ao atualizar perfil" },
            { status: 500 }
        );
    }
}
