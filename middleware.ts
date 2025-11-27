import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Se o usuário estiver autenticado e tentar acessar páginas de auth, redirecionar para home
    const isAuth = !!req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth");

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/", req.url));
      }
      return null; // Permite acesso à página de login se não estiver autenticado
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Permitir acesso às páginas de autenticação para que o middleware function possa tratar o redirecionamento
        if (req.nextUrl.pathname.startsWith("/auth")) {
          return true;
        }
        // Para todas as outras rotas, exigir token
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
