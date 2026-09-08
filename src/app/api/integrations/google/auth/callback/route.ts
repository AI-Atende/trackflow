import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  console.log('Google Auth Callback: Started');

  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Google Auth Callback Error:', error);
    return new NextResponse(`Google Auth Error: ${error}`, { status: 400 });
  }

  if (!code) {
    return new NextResponse('Missing code', { status: 400 });
  }

  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl === 'undefined') {
    const host = request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    if (host) {
      appUrl = `${proto}://${host}`;
    }
  }

  const REDIRECT_URI = `${appUrl}/api/integrations/google/auth/callback`;
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Google Token Exchange Error:', tokens);
      throw new Error(tokens.error_description || tokens.error);
    }

    const { access_token, refresh_token, expires_in } = tokens;
    const expiryDate = new Date(Date.now() + expires_in * 1000);

    console.log('Google Auth: Tokens received. Refresh Token present:', !!refresh_token);

    // Update Client
    await prisma.client.update({
      where: { id: session.user.clientId },
      data: {
        googleUserAccessToken: access_token,
        googleUserRefreshToken: refresh_token, // Might be null if user re-auths without prompt=consent, but we force it.
        googleUserTokenExpiry: expiryDate,
      },
    });

    // Return HTML to close popup
    const html = `
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'google_auth_success' }, '*');
            window.close();
          </script>
          <p>Google Ads conectado com sucesso! Fechando...</p>
        </body>
      </html>
    `;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Google Auth Critical Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(`Authentication Failed: ${message}`, { status: 500 });
  }
}
