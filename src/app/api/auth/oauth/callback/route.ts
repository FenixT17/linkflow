import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { setAuthSessionCookie } from "@/lib/auth.server";
import { normalizeEnvUrl } from "@/lib/utils";

const APPWRITE_ENDPOINT = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://cloud.appwrite.io/v1"
);
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const MAX_SECRET_LENGTH = 4096;

/**
 * Retorno do OAuth2 (web).
 *
 * Quando o utilizador autoriza no provider (Google/GitHub), o Appwrite
 * redireciona para o `success` URL (definido no /api/auth/oauth/start) com
 * `userId` e `secret` anexados à query string. Para completar o login, a app
 * troca essas credenciais por uma sessão real via POST /account/sessions
 * (mesmo mecanismo documentado pelo Appwrite para OAuth web).
 *
 * Porque server-side? O fluxo anterior dependia de cookies cross-site
 * (`a_session_*` no domínio do Appwrite) — bloqueados por 3P cookie blocking
 * no Chrome/Safari, o que devolvia o utilizador ao login. Este callback
 * executa a troca no servidor e define o cookie HttpOnly da app (mesmo padrão
 * verificado do createEmailPasswordSessionResolved), sem depender do browser.
 */
export async function GET(request: NextRequest) {
  if (!PROJECT_ID) {
    return NextResponse.redirect(new URL("/login?error=missing_project", request.url));
  }

  const userId = request.nextUrl.searchParams.get("userId") ?? "";
  const secret = request.nextUrl.searchParams.get("secret") ?? "";

  // Appwrite Cloud (web OAuth) NÃO anexa userId+secret ao success URL — a
  // sessão fica no domínio do Appwrite (cookie `a_session_*`, SameSite=None)
  // e o browser completa a recuperação via o fallback do SDK já existente:
  //   getCurrentSession → /api/auth/me 401 → createOAuthAccount().get()
  //   (fetch cross-site com o cookie) → x-fallback-cookies em localStorage
  //   → migrateLegacyBrowserSession → /api/auth/session → cookie HttpOnly.
  // Por isso, quando não há credenciais no URL, redireciona para o dashboard
  // para disparar esse fluxo (a sessão é criada no browser, não aqui).
  if (!userId || !secret) {
    const returning = new URL("/dashboard", request.url);
    returning.searchParams.set("oauth", "returning");
    return NextResponse.redirect(returning);
  }

  let rateLimit;
  try {
    rateLimit = await checkRateLimit("oauth_callback", getClientIp(request), {
      maxRequests: 10,
      windowMs: 10 * 60 * 1000,
    });
  } catch {
    return NextResponse.redirect(new URL("/login?error=service_unavailable", request.url));
  }
  if (!rateLimit.allowed) {
    return NextResponse.redirect(new URL("/login?error=rate_limited", request.url));
  }

  let upstream: Response;
  try {
    // Endpoint público (sem API key). POST /account/sessions/token é o
    // `createSession` do SDK atual — o mecanismo oficial para completar o
    // OAuth web com as credenciais userId+secret do success URL.
    upstream = await fetch(`${APPWRITE_ENDPOINT}/account/sessions/token`, {
      method: "POST",
      headers: {
        "X-Appwrite-Project": PROJECT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, secret }),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_network", request.url));
  }

  if (!upstream.ok) {
    // Reencaminha o erro real do Appwrite para a página de login (o
    // parseOAuthError decodifica o JSON no ?error=).
    const data = (await upstream.json().catch(() => ({}))) as {
      message?: unknown;
      type?: unknown;
      code?: unknown;
    };
    const message =
      typeof data.message === "string" && data.message.length > 0
        ? data.message.slice(0, 300)
        : "Falha na autenticação.";
    const errorJson = JSON.stringify({
      message,
      type: typeof data.type === "string" && data.type ? data.type : "oauth_failed",
      code: typeof data.code === "number" ? data.code : upstream.status,
    });
    const failure = new URL("/login", request.url);
    failure.searchParams.set("error", errorJson);
    return NextResponse.redirect(failure);
  }

  // Em fluxos públicos o body devolve `secret` vazio — o secret real vem no
  // Set-Cookie `a_session_<projectId>` (token opaco, não o JSON decodificado).
  // Tenta o body primeiro (caso o Appwrite o devolva) e depois o cookie.
  const data = (await upstream.json().catch(() => ({}))) as { secret?: unknown; expire?: unknown };
  let sessionSecret = typeof data.secret === "string" && data.secret.length >= 16 ? data.secret : "";
  let expire = typeof data.expire === "string" ? data.expire : "";

  const cookieName = `a_session_${PROJECT_ID}`;
  const setCookies = upstream.headers.getSetCookie
    ? upstream.headers.getSetCookie()
    : [upstream.headers.get("set-cookie")].filter((v): v is string => Boolean(v));
  for (const header of setCookies) {
    const name = header.slice(0, header.indexOf("=")).trim();
    if (name !== cookieName && name !== `${cookieName}_legacy`) continue;
    const semi = header.indexOf(";");
    const value = header.slice(header.indexOf("=") + 1, semi === -1 ? undefined : semi).trim();
    if (value.length >= 16 && value.length <= MAX_SECRET_LENGTH) {
      sessionSecret = value;
      const exp = header.match(/expires=([^;]+)/i);
      if (exp) expire = exp[1];
      break;
    }
  }

  if (!sessionSecret) {
    return NextResponse.redirect(new URL("/login?error=oauth_no_session", request.url));
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  setAuthSessionCookie(response, sessionSecret, expire || undefined);
  return response;
}
