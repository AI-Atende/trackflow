import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  console.log("Meta Auth Callback: Started");

  const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
  const META_APP_SECRET = process.env.META_APP_SECRET;

  if (!META_APP_ID || !META_APP_SECRET) {
    console.error("Meta Auth Callback Error: Missing App ID or Secret", { hasAppId: !!META_APP_ID, hasSecret: !!META_APP_SECRET });
    return new NextResponse("Server Configuration Error: Meta App ID or Secret is missing.", { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("Meta Auth Callback: No session");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    let appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Handle "undefined" string or missing value
    if (!appUrl || appUrl === "undefined") {
      const host = request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "https";
      if (host) {
        appUrl = `${proto}://${host}`;
      }
    }

    console.log("Meta Auth Callback: Resolved appUrl", appUrl);

    if (!appUrl) {
      console.error("Meta Auth Callback Error: NEXT_PUBLIC_APP_URL is not defined");
      return new NextResponse("Server Configuration Error: NEXT_PUBLIC_APP_URL is missing.", { status: 500 });
    }

    const REDIRECT_URI = `${appUrl}/api/integrations/meta/auth/callback`;
    console.log("Meta Auth Callback: REDIRECT_URI", REDIRECT_URI);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Meta Auth Callback: Error param received", error);
      return NextResponse.redirect(`${appUrl}/integrations?error=${error}`);
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get("meta_oauth_state")?.value;

    // Log for debugging (be careful with secrets in prod logs, but state is fine)
    console.log("Meta Auth Callback: State check", { received: state, stored: storedState });

    if (!state || state !== storedState) {
      console.error("Meta Auth Callback: Invalid state");
      return new NextResponse("Invalid state", { status: 400 });
    }

    if (!code) {
      console.error("Meta Auth Callback: Missing code");
      return new NextResponse("Missing code", { status: 400 });
    }

    // 1. Exchange code for short-lived token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${META_APP_SECRET}&code=${code}`;
    console.log("Meta Auth Callback: Exchanging token...");

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Meta Auth Callback: Token exchange error", tokenData.error);
      throw new Error(tokenData.error.message);
    }

    const shortLivedToken = tokenData.access_token;
    console.log("Meta Auth Callback: Got short-lived token");

    // 2. Exchange for long-lived token
    const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      console.error("Meta Auth Callback: Long-lived token exchange error", longLivedData.error);
      throw new Error(longLivedData.error.message);
    }

    const accessToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in ? new Date(Date.now() + longLivedData.expires_in * 1000) : null;
    console.log("Meta Auth Callback: Got long-lived token");

    // 3. Save to Client
    console.log("Meta Auth Callback: Updating database for client", session.user.clientId);
    await prisma.client.update({
      where: { id: session.user.clientId },
      data: {
        metaUserAccessToken: accessToken,
        metaUserTokenExpiry: expiresIn,
      },
    });
    console.log("Meta Auth Callback: Database updated");

    // 4. Return HTML to close popup and notify opener
    const html = `
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'meta_auth_success' }, '*');
            window.close();
          </script>
          <p>Autenticação realizada com sucesso! Fechando janela...</p>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error: any) {
    console.error("Meta Auth Critical Error:", error);
    const errorHtml = `
      <html>
        <body>
          <h3>Erro na Autenticação</h3>
          <p>${error.message || "Erro desconhecido"}</p>
          <script>
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
      </html>
    `;
    return new NextResponse(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
