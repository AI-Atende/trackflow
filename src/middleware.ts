import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isProfileComplete = token?.isProfileComplete;
    const path = req.nextUrl.pathname;

    if (token) {
      console.log('[MIDDLEWARE] Path:', path);
      console.log('[MIDDLEWARE] Token Email:', token.email);
      console.log('[MIDDLEWARE] Token isProfileComplete:', isProfileComplete);
      console.log('[MIDDLEWARE] Token Keys:', Object.keys(token));
    }

    // If user is logged in but profile is incomplete, redirect to complete profile page
    // Avoid redirect loop if already on the complete profile page
    if (token && !isProfileComplete && path !== '/auth/complete-profile') {
      return NextResponse.redirect(new URL('/auth/complete-profile', req.url));
    }

    // Removed the redirect to home if profile is complete.
    // We will let the client-side page handle that check to avoid conflicts/loops.
  },
  {
    callbacks: {
      // getToken() here decodes the session cookie directly — it does NOT re-run the jwt
      // callback (src/lib/auth.ts), so token.isActive only reflects DB state as of the last
      // real NextAuth pipeline hit (login, or a session refetch — see AuthProvider.tsx's
      // polling + signOut guard, which is what actually ends an already-open session soon
      // after a deactivation). This check mainly blocks a fresh page load with an already
      // stale/deactivated cookie (e.g. right after authorize() rejected a new login).
      authorized: ({ token }) => !!token && token.isActive !== false,
    },
  },
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - auth/login (login page)
     * - auth/register (register page)
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!auth/login|auth/register|auth/sso|api|legal|_next/static|_next/image|favicon.ico).*)',
  ],
};
