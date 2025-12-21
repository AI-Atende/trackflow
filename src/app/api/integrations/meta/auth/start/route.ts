import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/auth/callback`;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  console.log("Debug Meta Auth Start:");
  console.log("NEXT_PUBLIC_META_APP_ID:", process.env.NEXT_PUBLIC_META_APP_ID);
  console.log("META_APP_ID:", process.env.META_APP_ID);

  if (!META_APP_ID) {
    return new NextResponse(`Meta App ID not configured. Value: ${META_APP_ID}`, { status: 500 });
  }

  const state = Math.random().toString(36).substring(7);
  const cookieStore = await cookies();
  cookieStore.set("meta_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production" });

  const scope = "ads_management,ads_read,read_insights";
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&state=${state}&scope=${scope}`;

  return NextResponse.redirect(url);
}
