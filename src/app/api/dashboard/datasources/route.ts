import { getAvailableDataSources } from '@/services/hybridService';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(_request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sources = await getAvailableDataSources(session.user.clientId);
  return NextResponse.json(sources);
}
