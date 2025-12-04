import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const users = await prisma.client.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            image: true,
            metaAdAccounts: {
                select: {
                    id: true,
                    adAccountId: true,
                    status: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role, adAccountId, adAccountName, accessToken } = body;

    if (!name || !email || !password) {
        return NextResponse.json(
            { error: "Campos obrigatórios faltando" },
            { status: 400 }
        );
    }

    const existingUser = await prisma.client.findUnique({ where: { email } });
    if (existingUser) {
        return NextResponse.json(
            { error: "Email já cadastrado" },
            { status: 400 }
        );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Gerar imagem padrão se não fornecida
    const defaultImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    const newUser = await prisma.client.create({
        data: {
            name,
            email,
            passwordHash,
            role: role || "MEMBER",
            image: defaultImage,
            metaAdAccounts: adAccountId ? {
                create: {
                    adAccountId,
                    name: adAccountName || `Conta de ${name}`,
                    accessToken: accessToken || "", // Idealmente obrigatório se adAccountId for fornecido
                    status: "ACTIVE"
                }
            } : undefined
        },
        include: {
            metaAdAccounts: true
        }
    });

    return NextResponse.json({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        image: newUser.image,
        metaAdAccounts: newUser.metaAdAccounts
    });
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, email, role, isActive, password, adAccountId, adAccountName, accessToken } = body;

    if (!id) {
        return NextResponse.json({ error: "ID do usuário obrigatório" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (email) dataToUpdate.email = email;
    if (role) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (password) {
        dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    try {
        // Atualizar dados do usuário
        // Note: Updating metaAdAccounts in 1:N is complex via nested write without ID.
        // For simplicity in this admin tool, if adAccountId is provided, we will try to create it if it doesn't exist.
        // Or we could just ignore it for now in PUT if it's too complex, but let's try to support adding one.

        const updateData: any = {
            ...dataToUpdate,
        };

        if (adAccountId) {
            updateData.metaAdAccounts = {
                create: {
                    adAccountId,
                    name: adAccountName || `Conta de ${name || "Cliente"}`,
                    accessToken: accessToken || "",
                    status: "ACTIVE"
                }
            };
        }

        const updatedUser = await prisma.client.update({
            where: { id },
            data: updateData,
            include: {
                metaAdAccounts: true
            }
        });

        return NextResponse.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            metaAdAccounts: updatedUser.metaAdAccounts
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "Erro ao atualizar usuário" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID do usuário obrigatório" }, { status: 400 });
        }

        if (id === session.user.id) {
            return NextResponse.json({ error: "Você não pode excluir sua própria conta" }, { status: 400 });
        }

        await prisma.client.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        return NextResponse.json(
            { error: "Erro ao excluir usuário" },
            { status: 500 }
        );
    }
}
