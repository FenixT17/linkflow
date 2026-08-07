import { NextRequest, NextResponse } from "next/server";
import {
  extractLegacySessionSecret,
  getAuthSessionSecret,
  setAuthSessionCookie,
} from "@/lib/auth.server";

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
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

  const sessionSecret = getAuthSessionSecret(request);
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
    headers: responseHeaders,
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
