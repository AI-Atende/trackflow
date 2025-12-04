import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
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
    const defaultImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    const newUser = await prisma.client.create({
      data: {
        name,
        email,
        passwordHash,
        role: "MEMBER",
        image: defaultImage,
        isActive: true,
        // Profile fields are left empty to trigger "Complete Profile" flow
      },
    });

    return NextResponse.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    });

  } catch (error) {
    console.error("Erro no registro:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    );
  }
}
