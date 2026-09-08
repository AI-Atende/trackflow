import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAuthUrl } from '@/lib/google-ads';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl === 'undefined') {
    const host = request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    if (host) {
      appUrl = `${proto}://${host}`;
    }
  }

  if (!appUrl) {
    return new NextResponse('Server Configuration Error: NEXT_PUBLIC_APP_URL is missing.', {
      status: 500,
    });
  }

  const REDIRECT_URI = `${appUrl}/api/integrations/google/auth/callback`;

  const url = getGoogleAuthUrl(REDIRECT_URI);

  return NextResponse.redirect(url);
}
