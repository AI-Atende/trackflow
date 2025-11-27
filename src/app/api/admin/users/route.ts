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
            metaAdAccount: {
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
            metaAdAccount: adAccountId ? {
                create: {
                    adAccountId,
                    name: adAccountName || `Conta de ${name}`,
                    accessToken: accessToken || "", // Idealmente obrigatório se adAccountId for fornecido
                    status: "ACTIVE"
                }
            } : undefined
        },
        include: {
            metaAdAccount: true
        }
    });

    return NextResponse.json({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        image: newUser.image,
        metaAdAccount: newUser.metaAdAccount
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
        const updatedUser = await prisma.client.update({
            where: { id },
            data: {
                ...dataToUpdate,
                metaAdAccount: adAccountId ? {
                    upsert: {
                        create: {
                            adAccountId,
                            name: adAccountName || `Conta de ${name || "Cliente"}`,
                            accessToken: accessToken || "",
                            status: "ACTIVE"
                        },
                        update: {
                            adAccountId,
                            name: adAccountName,
                            accessToken: accessToken ? accessToken : undefined, // Atualiza apenas se fornecido
                        }
                    }
                } : undefined
            },
            include: {
                metaAdAccount: true
            }
        });

        return NextResponse.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            metaAdAccount: updatedUser.metaAdAccount
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "Erro ao atualizar usuário" },
            { status: 500 }
        );
    }
}
