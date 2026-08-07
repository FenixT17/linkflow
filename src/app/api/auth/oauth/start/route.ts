import { NextRequest, NextResponse } from "next/server";
import { OAuthProvider } from "node-appwrite";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { normalizeEnvUrl } from "@/lib/utils";

const APPWRITE_ENDPOINT = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://cloud.appwrite.io/v1"
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
  const oauthUrl = new URL(
    `${appwrite.origin}${appwrite.pathname.replace(/\/$/, "")}/account/sessions/oauth2/${encodeURIComponent(provider)}`,
  );
  oauthUrl.searchParams.set("project", PROJECT_ID);
  // O Appwrite anexa userId+secret ao success URL. O callback troca essas
  // credenciais por uma sessão real server-side e define o cookie HttpOnly
  // da app — sem depender de cookies cross-site (bloqueados por 3P cookie
  // blocking no Chrome/Safari, que devolviam o utilizador ao login).
  oauthUrl.searchParams.set("success", new URL("/api/auth/oauth/callback", request.url).toString());
  oauthUrl.searchParams.set("failure", new URL("/login", request.url).toString());

  return NextResponse.redirect(oauthUrl, {
    headers: mergeRateLimitHeaders(undefined, rateLimit),
  });
}
