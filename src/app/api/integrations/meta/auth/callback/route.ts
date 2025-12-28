import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
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

  if (!appUrl) {
    console.error("Meta Auth Callback Error: NEXT_PUBLIC_APP_URL is not defined");
    return new NextResponse("Server Configuration Error: NEXT_PUBLIC_APP_URL is missing.", { status: 500 });
  }

  const REDIRECT_URI = `${appUrl}/api/integrations/meta/auth/callback`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${appUrl}/integrations?error=${error}`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("meta_oauth_state")?.value;
  if (!state || state !== storedState) {
    return new NextResponse("Invalid state", { status: 400 });
  }

  if (!code) {
    return new NextResponse("Missing code", { status: 400 });
  }

  try {
    // 1. Exchange code for short-lived token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${META_APP_SECRET}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message);
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange for long-lived token
    const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      throw new Error(longLivedData.error.message);
    }

    const accessToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in ? new Date(Date.now() + longLivedData.expires_in * 1000) : null;

    // 3. Save to Client
    await prisma.client.update({
      where: { id: session.user.clientId },
      data: {
        metaUserAccessToken: accessToken,
        metaUserTokenExpiry: expiresIn,
      },
    });

    // 4. Redirect to Integrations page with action to open modal
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/integrations?action=select_meta_account`);

  } catch (error) {
    console.error("Meta Auth Error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=auth_failed`);
  }
}
