import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("Meta Auth Error: NEXT_PUBLIC_APP_URL is not defined");
    return new NextResponse("Server Configuration Error: NEXT_PUBLIC_APP_URL is missing.", { status: 500 });
  }

  const REDIRECT_URI = `${appUrl}/api/integrations/meta/auth/callback`;

  console.log("Debug Meta Auth Start:");
  console.log("Env Keys:", Object.keys(process.env).join(", "));
  console.log("NEXT_PUBLIC_META_APP_ID:", process.env.NEXT_PUBLIC_META_APP_ID);
  console.log("META_APP_ID:", process.env.META_APP_ID);
  console.log("REDIRECT_URI:", REDIRECT_URI);

  // Fallback
  const effectiveAppId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;

  if (!effectiveAppId) {
    return new NextResponse(`Meta App ID not configured. Value: ${effectiveAppId}`, { status: 500 });
  }

  const state = Math.random().toString(36).substring(7);
  const cookieStore = await cookies();
  cookieStore.set("meta_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production" });

  const scope = "ads_management,ads_read,read_insights";
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${effectiveAppId}&redirect_uri=${REDIRECT_URI}&state=${state}&scope=${scope}`;

  return NextResponse.redirect(url);
}
