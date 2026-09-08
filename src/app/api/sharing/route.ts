import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    // Fetch invites sent by the user (as owner)
    const sentInvites = await prisma.accountInvite.findMany({
      where: { ownerId: session.user.clientId },
      include: {
        guest: {
          select: { name: true, email: true, image: true },
        },
      },
    });

    // Fetch invites received by the user (as guest)
    const receivedInvites = await prisma.accountInvite.findMany({
      where: { guestId: session.user.clientId },
      include: {
        owner: {
          select: { name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ sent: sentInvites, received: receivedInvites });
  } catch (error) {
    console.error('Erro ao buscar convites:', error);
    return NextResponse.json({ error: 'Erro ao buscar convites' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
  }

  if (email === session.user.email) {
    return NextResponse.json({ error: 'Você não pode convidar a si mesmo' }, { status: 400 });
  }

  try {
    // Check if user exists
    const guest = await prisma.client.findUnique({
      where: { email },
    });

    if (!guest) {
      return NextResponse.json(
        { error: 'Usuário não encontrado. Peça para ele se cadastrar primeiro.' },
        { status: 404 },
      );
    }

    // Check if invite already exists
    const existingInvite = await prisma.accountInvite.findUnique({
      where: {
        ownerId_guestId: {
          ownerId: session.user.clientId,
          guestId: guest.id,
        },
      },
    });

    if (existingInvite) {
      return NextResponse.json({ error: 'Convite já enviado para este usuário.' }, { status: 409 });
    }

    // Create invite
    const invite = await prisma.accountInvite.create({
      data: {
        ownerId: session.user.clientId,
        guestId: guest.id,
        status: 'PENDING',
      },
    });

    return NextResponse.json(invite);
  } catch (error) {
    console.error('Erro ao enviar convite:', error);
    return NextResponse.json({ error: 'Erro ao enviar convite' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { inviteId, status } = await req.json();

  if (!inviteId || !['ACCEPTED', 'DECLINED'].includes(status)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  try {
    // Verify invite ownership (must be the guest)
    const invite = await prisma.accountInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.guestId !== session.user.clientId) {
      return NextResponse.json(
        { error: 'Convite não encontrado ou sem permissão' },
        { status: 403 },
      );
    }

    const updatedInvite = await prisma.accountInvite.update({
      where: { id: inviteId },
      data: { status },
    });

    return NextResponse.json(updatedInvite);
  } catch (error) {
    console.error('Erro ao atualizar convite:', error);
    return NextResponse.json({ error: 'Erro ao atualizar convite' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const inviteId = searchParams.get('id');

  if (!inviteId) {
    return NextResponse.json({ error: 'ID do convite é obrigatório' }, { status: 400 });
  }

  try {
    // Verify permission (Owner or Guest can delete/cancel)
    const invite = await prisma.accountInvite.findUnique({
      where: { id: inviteId },
    });

    if (
      !invite ||
      (invite.ownerId !== session.user.clientId && invite.guestId !== session.user.clientId)
    ) {
      return NextResponse.json(
        { error: 'Convite não encontrado ou sem permissão' },
        { status: 403 },
      );
    }

    await prisma.accountInvite.delete({
      where: { id: inviteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover convite:', error);
    return NextResponse.json({ error: 'Erro ao remover convite' }, { status: 500 });
  }
}
