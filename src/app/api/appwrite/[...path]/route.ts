import { NextRequest, NextResponse } from "next/server";
import {
  extractLegacySessionSecret,
  getAuthSessionSecret,
  setAuthSessionCookie,
} from "@/lib/auth.server";
import { normalizeEnvUrl } from "@/lib/utils";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { validateThemePayload } from "@/lib/theme-validation";

// `normalizeEnvUrl` garante que APPWRITE_ENDPOINT nunca é vazia nem inválida
// (o CI injeta secrets não configurados como string vazia, o que faria
// `new URL(APPWRITE_ENDPOINT)` abaixo lançar TypeError em runtime).
const APPWRITE_ENDPOINT = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://nyc.cloud.appwrite.io/v1"
);
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const MAX_PROXY_BODY_BYTES = 10 * 1024 * 1024;

function isOAuthNavigation(path: string[]): boolean {
  return path[0] === "account" && path[1] === "sessions" && path[2] === "oauth2";
}

function isAccountPath(path: string[]): boolean {
  return path[0] === "account";
}

function isPublicAccountPath(path: string[]): boolean {
  return (path[1] === "verification" || path[1] === "recovery") && path.length <= 2;
}

function extractSessionSecretFromSetCookie(value: string | null): string | null {
  if (!value || !APPWRITE_PROJECT_ID) return null;
  const match = value.match(new RegExp(`(?:^|,\\s*)a_session_${APPWRITE_PROJECT_ID}=([^;]+)`));
  return match?.[1] || null;
}

function targetUrl(path: string[], request: NextRequest): URL {
  const base = new URL(APPWRITE_ENDPOINT);
  const suffix = path.map((part) => encodeURIComponent(part)).join("/");
  const target = new URL(`${base.origin}${base.pathname.replace(/\/$/, "")}/${suffix}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  return target;
}

function isAllowedTarget(target: URL): boolean {
  const configured = new URL(APPWRITE_ENDPOINT);
  return target.origin === configured.origin && target.pathname.startsWith(`${configured.pathname.replace(/\/$/, "/")}`);
}

// O handler é privado: o typegen do Next.js 15.5 só aceita exports de métodos
// HTTP (GET/POST/...) em route handlers — um export extra `handler` faz o
// `next build` falhar com "Property 'handler' is incompatible with index
// signature".
async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return new NextResponse(null, { status: 405, headers: { Allow: [...ALLOWED_METHODS].join(", ") } });
  }
  if (!APPWRITE_PROJECT_ID) {
    return NextResponse.json({ error: "Appwrite not configured" }, { status: 503 });
  }

  const sessionSecret = getAuthSessionSecret(request);
  const rateLimitIdentifier = sessionSecret ? `user:${sessionSecret}` : `ip:${getClientIp(request)}`;
  let rateLimit;
  try {
    rateLimit = await checkRateLimit("api", rateLimitIdentifier, {
      maxRequests: 120,
      windowMs: 60 * 1000,
    });
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }

  const { path } = await context.params;
  const target = targetUrl(path, request);
  if (!isAllowedTarget(target)) {
    return NextResponse.json({ error: "Invalid Appwrite target" }, { status: 400 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (["host", "content-length", "cookie", "x-fallback-cookies", "authorization", "x-appwrite-jwt", "x-appwrite-session"].includes(lower)) {
      return;
    }
    headers.set(key, value);
  });
  headers.set("X-Appwrite-Project", APPWRITE_PROJECT_ID);

  if (isAccountPath(path) && !sessionSecret && !isOAuthNavigation(path) && !isPublicAccountPath(path)) {
    // Login, registration, password/session creation, JWT issuance and all
    // other account mutations must use the Redis-protected app routes.
    return NextResponse.json({ error: "Use the application authentication flow." }, { status: 403 });
  }
  if (sessionSecret) headers.set("X-Appwrite-Session", sessionSecret);

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const isThemeDocumentMutation =
    (request.method === "PUT" || request.method === "PATCH") &&
    path[0] === "databases" &&
    path[2] === "collections" &&
    path[3] === "themes" &&
    path[4] === "documents" &&
    path.length === 6;
  const isThemeDocumentCreate =
    request.method === "POST" &&
    path[0] === "databases" &&
    path[2] === "collections" &&
    path[3] === "themes" &&
    path[4] === "documents" &&
    path.length === 5;
  if ((isThemeDocumentMutation || isThemeDocumentCreate) && body) {
    try {
      const payload = JSON.parse(new TextDecoder().decode(body)) as { data?: unknown };
      const validationError = validateThemePayload(payload.data);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    } catch {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }
  }

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (["set-cookie", "access-control-allow-origin", "access-control-allow-credentials", "content-length", "x-fallback-cookies"].includes(lower)) {
      return;
    }
    if (lower === "location") {
      responseHeaders.set("Location", value);
      return;
    }
    responseHeaders.set(key, value);
  });
  responseHeaders.set("Cache-Control", "no-store");

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: mergeRateLimitHeaders(responseHeaders, rateLimit),
  });

  // Appwrite Cloud may return the browser SDK fallback cookie during OAuth.
  // Validate it server-side and immediately convert it to our HttpOnly cookie.
  const fallbackSecret = extractLegacySessionSecret(upstream.headers.get("x-fallback-cookies"))
    ?? extractSessionSecretFromSetCookie(upstream.headers.get("set-cookie"));
  if (fallbackSecret) setAuthSessionCookie(response, fallbackSecret);
  return response;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
