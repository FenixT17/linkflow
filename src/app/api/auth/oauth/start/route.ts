import { NextRequest, NextResponse } from "next/server";
import { OAuthProvider } from "node-appwrite";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { setOAuthConsentCookie, setOAuthStateCookie } from "@/lib/auth.server";
import { generateToken } from "@/lib/csrf";
import { normalizeEnvUrl } from "@/lib/utils";

const APPWRITE_ENDPOINT = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://fra.cloud.appwrite.io/v1"
);
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const PROVIDERS: Record<string, string> = {
  google: OAuthProvider.Google,
  github: OAuthProvider.Github,
};

export async function GET(request: NextRequest) {
  if (!PROJECT_ID) {
    return NextResponse.redirect(new URL("/login?error=missing_project", request.url));
  }

  const providerKey = request.nextUrl.searchParams.get("provider")?.toLowerCase() ?? "";
  const provider = PROVIDERS[providerKey];
  if (!provider) {
    return NextResponse.json({ error: "OAuth provider inválido." }, { status: 400 });
  }

  let rateLimit;
  try {
    rateLimit = await checkRateLimit("oauth_start", getClientIp(request), {
      maxRequests: 5,
      windowMs: 10 * 60 * 1000,
    });
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas OAuth. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }

  const appwrite = new URL(APPWRITE_ENDPOINT);
  // Fluxo TOKEN (createOAuth2Token): GET /account/tokens/oauth2/{provider}.
  // Ao contrário do fluxo session (/account/sessions/oauth2/...), que guarda
  // a sessão num cookie a_session_* no domínio do Appwrite (bloqueado por 3P
  // cookie blocking e impossível de ler num Worker), o fluxo token anexa
  // `idUtilizador`+`secret` ao success URL. O callback troca essas credenciais por
  // uma sessão real server-side (POST /account/sessions/token) e define o
  // cookie HttpOnly da app — sem depender de cookies cross-site.
  const oauthUrl = new URL(
    `${appwrite.origin}${appwrite.pathname.replace(/\/$/, "")}/account/tokens/oauth2/${encodeURIComponent(provider)}`,
  );
  oauthUrl.searchParams.set("project", PROJECT_ID);
  oauthUrl.searchParams.set("success", new URL("/api/auth/oauth/callback", request.url).toString());
  oauthUrl.searchParams.set("failure", new URL("/login", request.url).toString());

  // M2: marca o browser que iniciou o fluxo com um cookie de estado. O
  // callback exige a sua presença antes de trocar idUtilizador+secret por sessão —
  // impede login CSRF (um atacante não consegue semear este cookie no
  // browser da vítima).
  const response = NextResponse.redirect(oauthUrl, {
    headers: mergeRateLimitHeaders(undefined, rateLimit),
  });
  setOAuthStateCookie(response, generateToken());
  // Prova de consentimento: só o registo envia ?consent=1 (a página de login
  // não o faz). /api/auth/oauth/sync lê este cookie e grava a data/hora no
  // perfil do novo utilizador.
  if (request.nextUrl.searchParams.get("consent") === "1") {
    setOAuthConsentCookie(response);
  }
  return response;
}
