import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listGoogleConversionActions } from '@/lib/google/conversionUpload';

// GET /api/google-conversion-mapping/available-actions — lists the client's existing Google Ads
// Conversion Actions (created by them in Google Ads UI), resolved live — same "fetch live options
// from the platform" pattern as the Kommo field/stage pickers.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const actions = await listGoogleConversionActions(session.user.clientId);
    return NextResponse.json({ actions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar ações de conversão do Google' },
      { status: 502 },
    );
  }
}
