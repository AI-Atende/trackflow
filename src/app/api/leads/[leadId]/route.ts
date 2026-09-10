import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/leads/[leadId] — hard delete a Lead, its ConversionEventLog history, and the
// TrackedMessage rows for its phone number. Mainly a testing convenience: Lead's
// @@unique([clientId, kommoLeadId]) and ConversionEventLog's @@unique([leadId, journeyStageId,
// platform]) both mean a lead that already went through the journey once won't re-fire events on
// a fresh test run unless its old rows are cleared first — and classifyAttribution (TRACKED /
// EXTERNAL / UNTRACKED) reads TrackedMessage history, so leaving old messages behind would keep
// classifying a "fresh" test lead based on stale matches. Doesn't touch PixelSession (it's keyed
// by browser session, not phone number, so it doesn't carry over between test runs anyway), and
// doesn't move/delete anything in Kommo itself.
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

  await prisma.$transaction([
    prisma.conversionEventLog.deleteMany({ where: { leadId } }),
    ...(lead.waId
      ? [prisma.trackedMessage.deleteMany({ where: { clientId: lead.clientId, waId: lead.waId } })]
      : []),
    prisma.lead.delete({ where: { id: leadId } }),
  ]);

  return NextResponse.json({ success: true });
}
