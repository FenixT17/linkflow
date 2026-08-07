import { Client, Account, Databases, Storage, Models } from "node-appwrite";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeEnvUrl } from "@/lib/utils";

const endpoint = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://cloud.appwrite.io/v1"
);
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";

/**
 * The application owns this cookie. It contains only the Appwrite session
 * secret and is never readable by browser JavaScript.
 *
 * `__Host-` is used in production so the cookie cannot be set for a parent
 * domain (cookie tossing). Development uses a non-prefixed name because
 * browsers do not accept Secure cookies over every local HTTP setup.
 */
export const AUTH_SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-linkflow-session" : "linkflow-session";

export interface SessionCookie {
  name: string;
  value: string;
}

/** Returns the current application session secret from a request cookie. */
export function getAuthSessionSecret(request: NextRequest): string | null {
  return findSessionCookie(request.cookies.getAll())?.value ?? null;
}

/**
 * Extracts the Appwrite browser SDK fallback session for the one-time OAuth
 * migration path. The value is validated as JSON and scoped to this project.
 */
export function extractLegacySessionSecret(value: string | null): string | null {
  if (!value || value.length > 16 * 1024) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const secret = (parsed as Record<string, unknown>)[`a_session_${projectId}`];
    return typeof secret === "string" && secret.length >= 16 && secret.length <= 4096
      ? secret
      : null;
  } catch {
    return null;
  }
}

function findSessionCookie(cookieList: Iterable<{ name: string; value: string }>): SessionCookie | null {
  for (const cookie of cookieList) {
    if (cookie.name === AUTH_SESSION_COOKIE_NAME && cookie.value) {
      return cookie;
    }
  }
  return null;
}

function getSessionCookieFromRequest(request: NextRequest): SessionCookie | null {
  return findSessionCookie(request.cookies.getAll());
}

async function getSessionCookieFromStore(): Promise<SessionCookie | null> {
  const cookieStore = await cookies();
  return findSessionCookie(cookieStore.getAll());
}

/** Create an unauthenticated Appwrite client for email/password auth. */
export function createPublicAuthClient(): { client: Client; account: Account } {
  if (!endpoint || !projectId) {
    throw new Error("Appwrite is not configured.");
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  return { client, account: new Account(client) };
}

/**
 * Creates an Appwrite email/password session via a direct REST call and
 * returns the session secret, even on public (key-less) flows.
 *
 * Why not `account.createEmailPasswordSession`? When called WITHOUT an API key,
 * Appwrite returns `secret: ""` in the JSON body and instead issues the real
 * session secret inside an `a_session_<projectId>` Set-Cookie header
 * (base64url-encoded `{ id, secret }`). The node-appwrite server SDK only
 * reads `body.secret` (empty) and does not expose the response Set-Cookie
 * headers, so the application session cookie would be set with an empty value
 * in runtimes like Cloudflare Workers. Doing the request with the global
 * `fetch` lets us read the header directly and works in both Node.js and
 * Workers.
 */
export async function createEmailPasswordSessionResolved(
  email: string,
  password: string,
): Promise<{ secret: string; expire: string; userId: string }> {
  const response = await fetch(`${endpoint}/account/sessions/email`, {
    method: "POST",
    headers: {
      "X-Appwrite-Project": projectId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = (await response.json()) as {
    $id?: unknown;
    userId?: unknown;
    expire?: unknown;
    secret?: unknown;
  };
  if (!response.ok) {
    const error = new Error(
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? "Appwrite session error")
        : "Appwrite session error",
    ) as Error & { code?: number; type?: string };
    if (typeof data === "object" && data) {
      error.code = (data as { code?: unknown }).code as number | undefined;
      error.type = (data as { type?: unknown }).type as string | undefined;
    }
    throw error;
  }

  // Public flow: secret comes via the a_session_* cookie, not the body.
  let secret =
    typeof data.secret === "string" && data.secret.length > 0 ? data.secret : "";
  if (!secret) {
    const cookieName = `a_session_${projectId}`;
    const setCookies = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter((v): v is string => Boolean(v));
    for (const header of setCookies) {
      const name = header.slice(0, header.indexOf("=")).trim();
      if (name !== cookieName && name !== `${cookieName}_legacy`) continue;
      const semi = header.indexOf(";");
      const value = header.slice(header.indexOf("=") + 1, semi === -1 ? undefined : semi).trim();
      if (!value) continue;
      try {
        const decoded = JSON.parse(
          Buffer.from(value, "base64url").toString("utf8"),
        ) as { secret?: unknown };
        if (typeof decoded.secret === "string" && decoded.secret.length >= 16) {
          secret = decoded.secret;
          break;
        }
      } catch {
        // try next Set-Cookie header
      }
    }
  }

  if (!secret) {
    throw new Error("Appwrite did not return a session secret.");
  }
  return {
    secret,
    expire: typeof data.expire === "string" ? data.expire : "",
    userId: typeof data.userId === "string" ? data.userId : typeof data.$id === "string" ? data.$id : "",
  };
}

/**
 * Creates a request-scoped Appwrite client authenticated only by the
 * application-owned HttpOnly cookie. Authorization/JWT headers are ignored
 * deliberately: they must not bypass the normal session flow.
 */
export async function createSessionClient(request?: NextRequest) {
  const sessionCookie = request
    ? getSessionCookieFromRequest(request)
    : await getSessionCookieFromStore();

  if (!sessionCookie) return null;

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setSession(sessionCookie.value);
  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

/** Apply the secure application session cookie to a response. */
export function setAuthSessionCookie(response: NextResponse, secret: string, expires?: string): void {
  const expiresAt = expires ? Date.parse(expires) : NaN;
  const maxAge = Number.isFinite(expiresAt)
    ? Math.max(1, Math.floor((expiresAt - Date.now()) / 1000))
    : undefined;

  response.cookies.set(AUTH_SESSION_COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax permits the OAuth provider's top-level redirect back to LinkFlow.
    sameSite: "lax",
    path: "/",
    ...(maxAge ? { maxAge, expires: new Date(expiresAt) } : {}),
  });
}

/** Clear the application-owned session cookie. */
export function clearAuthSessionCookie(response: NextResponse): void {
  response.cookies.set(AUTH_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Retrieves the currently authenticated Appwrite user from the application
 * session cookie. Invalid/expired sessions are treated as unauthenticated.
 */
export async function getCurrentUser(request?: NextRequest): Promise<Models.User<Models.Preferences> | null> {
  const sessionClient = await createSessionClient(request);
  if (!sessionClient) return null;

  try {
    return await sessionClient.account.get();
  } catch {
    return null;
  }
}

/** Requires an authenticated application session inside an API route. */
export async function requireAuth(request: NextRequest): Promise<
  | {
      user: Models.User<Models.Preferences>;
      account: Account;
      databases: import("node-appwrite").Databases;
    }
  | NextResponse
> {
  const sessionClient = await createSessionClient(request);
  if (!sessionClient) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await sessionClient.account.get();
    return { user, account: sessionClient.account, databases: sessionClient.databases };
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export function verifyOwnership(documentUserId: string, currentUserId: string): boolean {
  return documentUserId === currentUserId;
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
