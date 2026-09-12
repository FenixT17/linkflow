import { NextRequest, NextResponse } from "next/server";

function createNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://cloud.appwrite.io https://*.cloud.appwrite.io${isDevelopment ? " ws: wss:" : ""}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Nome do cookie de sessãoHttpOnly — o mesmo definido em auth.server.ts.
 * No middleware (edge runtime) não podemos importar de server-only modules,
 * então o nome é duplicado aqui. Qualquer alteração em auth.server.ts tem
 * de ser espelhada neste ficheiro.
 */
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-linkflow-session" : "linkflow-session";

/** Rotas do dashboard que exigem autenticação. */
const PROTECTED_PATHS = ["/dashboard"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(request: NextRequest) {
  // --- Proteção server-side de rotas autenticadas --------------------------
  // O cookie de sessão é HttpOnly e só é definido após login/logout via API.
  // A presença do cookie é uma condição NECESSÁRIA (não suficiente) para
  // autenticação — a validação completa continua no servidor via requireAuth().
  // Este check impede que o HTML do dashboard seja servido a visitantes não
  // autenticados (elimina o flash de conteúdo protegido antes do redirect
  // client-side) e bloqueia ferramentas automatizadas que ignorem JS.
  if (isProtectedPath(request.nextUrl.pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (!sessionCookie || !sessionCookie.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("Accept-CH", "Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
