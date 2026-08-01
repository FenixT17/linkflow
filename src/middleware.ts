import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware global (Edge Runtime) — proteção server-side das rotas
 * autenticadas (M1 da auditoria de segurança).
 *
 * Antes: a proteção do dashboard era apenas client-side (AuthContext), o que
 * permitia scraping do HTML/SSR de /dashboard/* sem sessão. Este middleware:
 *
 *   a) Verifica a presença do cookie de sessão Appwrite `a_session_<projectId>`
 *      (fallback: qualquer cookie com prefixo `a_session_`, como em auth.server.ts).
 *   b) `/dashboard/:path*` → redireciona para /login se o cookie estiver ausente.
 *   c) `/api/:path*` → devolve 401 se ausente e método não-GET, EXCETO os
 *      endpoints públicos/anónimos listados em PUBLIC_API_PREFIXES (tracking
 *      de views/clicks, CSRF, rate-check, logs de segurança anónimos, sync
 *      OAuth — este último faz a sua própria verificação de sessão com
 *      requireAuth + rate limit).
 *
 * NOTA: não substitui o AuthContext nem o requireAuth das API routes — coexiste
 * com ambos (defesa em profundidade). A validação completa da sessão continua a
 * ser feita server-side (requireAuth) e client-side (AuthContext); o middleware
 * apenas bloqueia cedo o acesso sem cookie (rápido, sem custo de rede).
 */

const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const SESSION_COOKIE_PREFIX = "a_session_";

// Endpoints /api públicos ou com autenticação própria — NUNCA bloquear aqui.
const PUBLIC_API_PREFIXES = [
  "/api/view",            // tracking público de visualizações (anónimo)
  "/api/click",           // tracking público de cliques (anónimo)
  "/api/csrf",            // emissão/verificação do token CSRF (pré-login também)
  "/api/auth/rate-check", // verificação de rate limit pré-login
  "/api/auth/oauth/sync", // sync pós-login OAuth — faz requireAuth próprio
  "/api/security/log-anonymous", // eventos de segurança pré-login
  "/api/sitemap.xml.gz",  // sitemap público (GET)
];

function getSessionCookieName(): string {
  return projectId ? `${SESSION_COOKIE_PREFIX}${projectId}` : SESSION_COOKIE_PREFIX;
}

function hasSessionCookie(request: NextRequest): boolean {
  const cookieName = getSessionCookieName();
  if (request.cookies.get(cookieName)?.value) return true;
  // Fallback (projectId vazio/desconhecido): qualquer cookie de sessão Appwrite
  if (!projectId) {
    return request.cookies.getAll().some((c) => c.name.startsWith(SESSION_COOKIE_PREFIX));
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // b) Dashboard exige sessão
  if (pathname.startsWith("/dashboard")) {
    if (!hasSessionCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // c) API: mutações exigem sessão, exceto endpoints públicos
  if (pathname.startsWith("/api")) {
    const isPublic = PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (!isPublic && !isSafeMethod && !hasSessionCookie(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
