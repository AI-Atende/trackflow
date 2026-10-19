import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteLeads } from '@/lib/leadDeletion';

// DELETE /api/leads/[leadId] — hard delete one Lead, its ConversionEventLog history, and the
// TrackedMessage rows for its phone number. See lib/leadDeletion.ts for what is and isn't touched
// (and why); POST /api/leads/bulk-delete does the same for many leads at once.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.clientId !== session.user.clientId) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
  }

  await deleteLeads(lead.clientId, [leadId]);

  return NextResponse.json({ success: true });
}
