import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('[API] /api/goals - Session:', JSON.stringify(session, null, 2));

    if (!session?.user?.clientId) {
      console.log('[API] /api/goals - Unauthorized: Missing clientId');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const goals = await prisma.clientGoal.findMany({
      where: { clientId: session.user.clientId },
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.clientId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { goals } = body; // Expecting an array of goals to update/create

    if (!Array.isArray(goals)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const results = [];

    for (const goal of goals) {
      const { type, stageIndex, value } = goal;

      if (!type || value === undefined) continue;

      const updatedGoal = await prisma.clientGoal.upsert({
        where: {
          clientId_type_stageIndex: {
            clientId: session.user.clientId,
            type,
            stageIndex: stageIndex ?? 0, // Default to 0 if null, though unique constraint handles nulls differently in some DBs, Prisma handles it well usually.
            // Actually, for unique constraint with nullable fields, we need to be careful.
            // In Prisma schema: @@unique([clientId, type, stageIndex])
            // If stageIndex is null, it might be treated as unique.
            // Let's ensure we pass null explicitly if it's missing.
          },
        },
        update: { value },
        create: {
          clientId: session.user.clientId,
          type,
          stageIndex: stageIndex ?? null,
          value,
        },
      });
      results.push(updatedGoal);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error updating goals:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
