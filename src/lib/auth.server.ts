import { Client, Account, Databases, Storage, Models } from "node-appwrite";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
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
