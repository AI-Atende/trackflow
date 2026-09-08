import { fetchHybridData, DataSourceType } from "@/services/hybridService";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const dataSource = searchParams.get("dataSource") as DataSourceType;

  if (!since || !until || !dataSource) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const { campaigns, labels } = await fetchHybridData(session.user.clientId, dataSource, since, until);
    return NextResponse.json({ campaigns, labels });
  } catch (error) {
    console.error("Dashboard Data Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
