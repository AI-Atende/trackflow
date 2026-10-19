import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resyncTrackedMessage } from '@/lib/kommoAttribution';

// POST /api/tracked-messages/[id]/resync — re-runs the "write this message's attribution onto
// its Kommo lead" step for a message that didn't make it (lead not found yet, Kommo error, field
// mapping fixed since). Starts a fresh retry cycle; returns the resulting sync status so the UI
// can update in place. Only messages that actually matched something have anything to write.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const message = await prisma.trackedMessage.findFirst({
    where: { id, clientId: session.user.clientId },
    select: { id: true, matchedPixelSessionId: true, matchedMappedAdId: true },
  });
  if (!message) {
    return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
  }
  if (!message.matchedPixelSessionId && !message.matchedMappedAdId) {
    return NextResponse.json(
      { error: 'Essa mensagem não foi associada a nenhuma origem — não há o que gravar.' },
      { status: 400 },
    );
  }

  const outcome = await resyncTrackedMessage(message.id);
  return NextResponse.json(outcome);
}
