import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.clientId },
    select: {
      googleUserAccessToken: true,
      googleUserRefreshToken: true,
      googleUserTokenExpiry: true,
    },
  });

  if (!client?.googleUserRefreshToken) {
    return new NextResponse('Not connected to Google Ads', { status: 400 });
  }

  try {
    // Let's instantiate a new client for this user
    const { GoogleAdsApi } = await import('google-ads-api');

    const userClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_DEVELOPER_TOKEN!,
    });

    // listAccessibleCustomers is a method on the Service, not a Customer method.
    // But the library exposes it via the client instance usually.
    // Checking docs: client.listAccessibleCustomers(refreshToken)

    const result = await userClient.listAccessibleCustomers(client.googleUserRefreshToken);
    console.log('Google Ads listAccessibleCustomers result:', JSON.stringify(result, null, 2));

    // The library might return the array directly, or an object with resource_names/resourceNames
    let resourceNames: string[] = [];

    if (Array.isArray(result)) {
      resourceNames = result;
    } else if (result && typeof result === 'object') {
      if (Array.isArray(result.resource_names)) {
        resourceNames = result.resource_names;
        // @ts-expect-error - fallback for a camelCase response shape not covered by the library's types
      } else if (Array.isArray(result.resourceNames)) {
        // @ts-expect-error - fallback for a camelCase response shape not covered by the library's types
        resourceNames = result.resourceNames;
      }
    }

    const accounts = resourceNames.map((name: string) => {
      const id = name.split('/')[1];
      return {
        id: id,
        name: `Account ${id}`,
        currency: 'Unknown',
      };
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching Google Ads accounts:', error);
    // If it's a library error, it might have a specific structure
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return new NextResponse(`Failed to fetch accounts: ${msg}`, { status: 500 });
  }
}
