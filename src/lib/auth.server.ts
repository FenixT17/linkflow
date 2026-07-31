import { Client, Account, Databases, Storage, Models } from "node-appwrite";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";

interface SessionCookie {
  name: string;
  value: string;
}

function findSessionCookie(cookies: Iterable<{ name: string; value: string }>): SessionCookie | null {
  const cookieName = projectId ? `a_session_${projectId}` : undefined;
  for (const cookie of cookies) {
    if (cookie.name === cookieName) return cookie;
    if (!cookieName && cookie.name.startsWith("a_session_")) return cookie;
  }
  // Fallback: any Appwrite session cookie
  for (const cookie of cookies) {
    if (cookie.name.startsWith("a_session_")) return cookie;
  }
  return null;
}

function getSessionCookieFromRequest(request: NextRequest): SessionCookie | null {
  const cookie = findSessionCookie(request.cookies.getAll());
  return cookie;
}

async function getSessionCookieFromStore(): Promise<SessionCookie | null> {
  // Next.js 15 cookies() is async in Server Components/Actions
  const cookieStore = await (cookies() as unknown as Promise<ReturnType<typeof cookies>>);
  return findSessionCookie(cookieStore.getAll());
}

/**
 * Creates an Appwrite client authenticated with the user's session cookie.
 * Returns null if no session cookie is present.
 */
export async function createSessionClient(request?: NextRequest) {
  const sessionCookie = request
    ? getSessionCookieFromRequest(request)
    : await getSessionCookieFromStore();

  if (!sessionCookie) return null;

  const client = new Client().setEndpoint(endpoint).setProject(projectId);

  // Authenticate as the user by forwarding the Appwrite session cookie.
  // We deliberately do NOT set the API key here; this client is meant
  // to act on behalf of the logged-in user, not as an admin.
  client.addHeader("Cookie", `${sessionCookie.name}=${sessionCookie.value}`);

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

/**
 * Retrieves the currently authenticated Appwrite user from the session cookie.
 * Returns null if no valid session exists.
 */
export async function getCurrentUser(request?: NextRequest): Promise<Models.User<Models.Preferences> | null> {
  const sessionClient = await createSessionClient(request);
  if (!sessionClient) return null;

  try {
    const user = await sessionClient.account.get();
    return user;
  } catch {
    return null;
  }
}

/**
 * Requires an authenticated session. Returns the user or a 401 response.
 * Use inside API route handlers.
 */
export async function requireAuth(request: NextRequest): Promise<
  | { user: Models.User<Models.Preferences>; databases: import("node-appwrite").Databases }
  | NextResponse
> {
  const sessionClient = await createSessionClient(request);
  if (!sessionClient) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await sessionClient.account.get();
    return { user, databases: sessionClient.databases };
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * Verifies that a document belongs to the authenticated user.
 * Expects the document to have a `userId` field.
 */
export function verifyOwnership(documentUserId: string, currentUserId: string): boolean {
  return documentUserId === currentUserId;
}

/**
 * Helper to handle the common 403 response shape.
 */
export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Helper to handle the common 401 response shape.
 */
export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
