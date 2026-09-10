import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  listGoogleConversionActions,
  createGoogleConversionAction,
  type GoogleConversionActionCategory,
} from '@/lib/google/conversionUpload';

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

const VALID_CATEGORIES: GoogleConversionActionCategory[] = ['IMPORTED_LEAD', 'PURCHASE'];

// POST /api/google-conversion-mapping/available-actions — creates a new Conversion Action in the
// client's Google Ads account, so a journey stage can be mapped without leaving TrackFlow first.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { name, category } = body ?? {};
  if (!name || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: 'name e category (IMPORTED_LEAD | PURCHASE) são obrigatórios' },
      { status: 400 },
    );
  }

  try {
    const action = await createGoogleConversionAction(session.user.clientId, name, category);
    return NextResponse.json({ action });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar ação de conversão no Google' },
      { status: 502 },
    );
  }
}
