import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { adAccountId, name } = body;

  if (!adAccountId) {
    return new NextResponse("Missing adAccountId", { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: { metaUserAccessToken: true, metaUserTokenExpiry: true }
  });

  if (!client?.metaUserAccessToken) {
    return new NextResponse("Not connected to Meta", { status: 400 });
  }

  try {
    // Upsert MetaAdAccount
    // We use the USER token for the account.

    // 1. Deactivate other accounts for this client to ensure only one is active
    await prisma.metaAdAccount.updateMany({
      where: {
        clientId: session.user.clientId,
        adAccountId: { not: adAccountId }
      },
      data: { status: "INACTIVE" }
    });

    // Check if exists
    const existing = await prisma.metaAdAccount.findFirst({
      where: {
        clientId: session.user.clientId,
        adAccountId: adAccountId
      }
    });

    if (existing) {
      await prisma.metaAdAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: client.metaUserAccessToken,
          tokenExpiresAt: client.metaUserTokenExpiry,
          status: "ACTIVE", // Assume active if selected
          name: name || existing.name
        }
      });
    } else {
      await prisma.metaAdAccount.create({
        data: {
          clientId: session.user.clientId,
          adAccountId: adAccountId,
          accessToken: client.metaUserAccessToken,
          tokenExpiresAt: client.metaUserTokenExpiry,
          status: "ACTIVE",
          name: name || `Account ${adAccountId}`
        }
      });
    }

    // Also activate the integration config
    const integration = await prisma.integrationConfig.findFirst({
      where: { clientId: session.user.clientId, provider: "META" }
    });

    if (integration) {
      await prisma.integrationConfig.update({
        where: { id: integration.id },
        data: { isActive: true }
      });
    } else {
      await prisma.integrationConfig.create({
        data: {
          clientId: session.user.clientId,
          provider: "META",
          isActive: true,
          journeyMap: ["impressions", "clicks", "leads"]
        }
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error selecting ad account:", error);
    return new NextResponse("Failed to select account", { status: 500 });
  }
}
