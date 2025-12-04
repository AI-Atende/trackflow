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
            fullName: true,
            email: true,
            image: true,
            role: true,
            phone: true,
            birthDate: true,
            address: true,
            termsAccepted: true,
            lgpdConsent: true,
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
    const { name, fullName, image, phone, birthDate, address, termsAccepted, lgpdConsent } = body;

    try {
        const updatedUser = await prisma.client.update({
            where: { id: session.user.clientId },
            data: {
                name,
                fullName,
                image,
                phone,
                birthDate: birthDate ? new Date(birthDate) : undefined,
                address,
                termsAccepted,
                lgpdConsent,
            },
        });

        return NextResponse.json({
            id: updatedUser.id,
            name: updatedUser.name,
            fullName: updatedUser.fullName,
            email: updatedUser.email,
            image: updatedUser.image,
            phone: updatedUser.phone,
            birthDate: updatedUser.birthDate,
            address: updatedUser.address,
            termsAccepted: updatedUser.termsAccepted,
            lgpdConsent: updatedUser.lgpdConsent,
        });
    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        return NextResponse.json(
            { error: "Erro ao atualizar perfil" },
            { status: 500 }
        );
    }
}
