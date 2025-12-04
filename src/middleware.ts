import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isProfileComplete = token?.isProfileComplete;
    const path = req.nextUrl.pathname;

    if (token) {
      console.log("[MIDDLEWARE] Path:", path);
      console.log("[MIDDLEWARE] Token Email:", token.email);
      console.log("[MIDDLEWARE] Token isProfileComplete:", isProfileComplete);
      console.log("[MIDDLEWARE] Token Keys:", Object.keys(token));
    }

    // If user is logged in but profile is incomplete, redirect to complete profile page
    // Avoid redirect loop if already on the complete profile page
    if (token && !isProfileComplete && path !== "/auth/complete-profile") {
      return NextResponse.redirect(new URL("/auth/complete-profile", req.url));
    }

    // Removed the redirect to home if profile is complete. 
    // We will let the client-side page handle that check to avoid conflicts/loops.
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
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
    "/((?!auth/login|auth/register|api|legal|_next/static|_next/image|favicon.ico).*)",
  ],
};
