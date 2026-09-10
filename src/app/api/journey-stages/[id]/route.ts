import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/journey-stages/[id] — hard delete only if nothing already references this stage
// (leads currently sitting in it, or conversion events already logged against it). Refusing
// instead of cascading avoids silently orphaning a lead's history.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const stage = await prisma.journeyStage.findUnique({ where: { id } });
  if (!stage || stage.clientId !== session.user.clientId) {
    return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 });
  }

  if (stage.position === 'FIRST' || stage.position === 'LAST') {
    return NextResponse.json(
      { error: 'As etapas inicial e final da jornada não podem ser removidas' },
      { status: 409 },
    );
  }

  const [leadCount, eventCount] = await Promise.all([
    prisma.lead.count({ where: { currentJourneyStageId: id } }),
    prisma.conversionEventLog.count({ where: { journeyStageId: id } }),
  ]);
  if (leadCount > 0 || eventCount > 0) {
    return NextResponse.json(
      {
        error: `Não é possível remover: ${leadCount} lead(s) e ${eventCount} evento(s) já referenciam essa etapa`,
      },
      { status: 409 },
    );
  }

  await prisma.journeyStage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
