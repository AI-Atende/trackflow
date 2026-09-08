import { exchangeCodeForTokens, listAccessibleCustomers } from '@/services/googleService';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Should be clientId if passed, or we use session
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  try {
    // 1. Exchange Code for Tokens
    const tokens = await exchangeCodeForTokens(code);
    // tokens: { access_token, refresh_token, expires_in, scope, token_type }

    if (!tokens.refresh_token) {
      // If user re-auths without prompt=consent, refresh_token might be missing.
      // We should probably warn or handle this.
      console.warn('Missing refresh_token. User might need to revoke access to get a new one.');
    }

    // 2. Identify User
    // We can use the 'state' param if we passed clientId there, or get session.
    // Let's try session first.
    const session = await getServerSession(authOptions);
    let clientId = session?.user?.clientId;

    if (!clientId && state) {
      // Fallback to state if session is missing (e.g. strict cookie policies?)
      clientId = state;
    }

    if (!clientId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // 3. Get Accessible Customers
    const customers = await listAccessibleCustomers(tokens.access_token);

    if (!customers || customers.length === 0) {
      return NextResponse.json(
        { error: 'No Google Ads accounts found for this user.' },
        { status: 404 },
      );
    }

    // 4. Save to DB
    // For now, we'll pick the first one or create all?
    // Let's create the first one found.
    // Resource name format: "customers/123-456-7890"
    const customerResourceName = customers[0];
    const customerId = customerResourceName.replace('customers/', '');

    // Check if exists
    const existing = await prisma.googleAdAccount.findFirst({
      where: {
        clientId,
        customerId,
      },
    });

    if (existing) {
      await prisma.googleAdAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existing.refreshToken, // Keep old if not provided
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          status: 'ACTIVE',
        },
      });
    } else {
      if (!tokens.refresh_token) {
        return NextResponse.json(
          { error: 'Missing refresh token for new account. Please revoke access and try again.' },
          { status: 400 },
        );
      }
      await prisma.googleAdAccount.create({
        data: {
          clientId,
          customerId,
          name: `Google Ads Account ${customerId}`, // Placeholder name
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          status: 'ACTIVE',
        },
      });
    }

    // Redirect back to settings
    return NextResponse.redirect(new URL('/settings/integrations?success=google', request.url));
  } catch (e) {
    console.error('Google Callback Error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
