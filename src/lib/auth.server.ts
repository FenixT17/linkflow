import { Client, Account, Databases, Storage, Models } from "node-appwrite";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeEnvUrl } from "@/lib/utils";

const endpoint = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://fra.cloud.appwrite.io/v1"
);
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const apiKey = process.env.APPWRITE_API_KEY ?? "";

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

/**
 * Cookie de estado do fluxo OAuth (anti login CSRF — M2).
 *
 * O callback OAuth (/api/auth/oauth/callback) recebe `userId`+`secret` na
 * query string (redirect do provider). Sem um estado ligado ao browser, um
 * atacante poderia induzir a vítima a abrir um link com o `userId`+`secret`
 * da conta DO ATACANTE, fazendo o browser da vítima definir a sessão do
 * atacante (login CSRF / session fixation). Este cookie (HttpOnly, curta
 * duração) só existe quando o próprio browser inicia o fluxo em
 * /api/auth/oauth/start — o callback exige a sua presença.
 */
export const OAUTH_STATE_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-linkflow-oauth-state" : "linkflow-oauth-state";
const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutos

export function setOAuthStateCookie(response: NextResponse, state: string): void {
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: o cookie tem de ser enviado no redirect top-level do provider.
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
}

export function clearOAuthStateCookie(response: NextResponse): void {
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function hasOAuthStateCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value);
}

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

/** Create an Appwrite server client for operations that require the API key. */
export function createServerAuthClient(): { client: Client; account: Account } {
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Appwrite server authentication is not configured.");
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { client, account: new Account(client) };
}

/**
 * Creates an Appwrite email/password session via a direct REST call and
 * returns the session secret, even on public (key-less) flows.
 *
 * Why not `account.createEmailPasswordSession`? When called WITHOUT an API key,
 * Appwrite returns `secret: ""` in the JSON body and instead issues the real
 * session secret as the VALUE of the `a_session_<projectId>` Set-Cookie header
 * (an opaque 256-char token; the cookie's base64url-decoded JSON payload only
 * holds `{ id, secret }` metadata and is NOT the credential — sending it as
 * `X-Appwrite-Session` returns 401). The node-appwrite server SDK only reads
 * `body.secret` (empty) and does not expose the response Set-Cookie headers,
 * so the application session cookie would be set with an empty value in
 * runtimes like Cloudflare Workers. Doing the request with the global `fetch`
 * lets us read the header directly and works in both Node.js and Workers.
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

  // Public (key-less) flow: Appwrite returns `secret: ""` in the JSON body
  // and issues the real session secret as the VALUE of the `a_session_<projectId>`
  // Set-Cookie header (a 256-char opaque token, NOT the decoded JSON inside
  // which is only metadata). Sending that raw cookie value as
  // `X-Appwrite-Session` authenticates correctly (verified: /account → 200).
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
      if (value.length >= 16) {
        secret = value;
        break;
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

/**
 * Duração padrão do cookie de sessão quando o Appwrite não devolve um
 * `expire` (ex.: migração do fallback OAuth em /api/auth/session). 30 dias,
 * alinhado com a duração típica das sessões do Appwrite.
 */
export const SESSION_COOKIE_FALLBACK_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Apply the secure application session cookie to a response.
 *
 * `persistent` (default: true) define se o cookie sobrevive a fechar o browser:
 * - true  → Max-Age/Expires usando o `expire` do Appwrite; se o Appwrite não
 *   o devolver, usa um fallback de 30 dias. Garante que o utilizador continua
 *   logado ao reabrir o site — incluindo a migração OAuth em /api/auth/session,
 *   que antes criava um cookie de sessão (sem Max-Age) que o browser apagava
 *   ao fechar, deslogando utilizadores mesmo com sessão Appwrite válida.
 * - false → cookie de sessão (sem Max-Age): some ao fechar o browser
 *   (checkbox "Lembrar-me" desmarcado no login).
 */
export function setAuthSessionCookie(
  response: NextResponse,
  secret: string,
  expires?: string,
  persistent = true,
): void {
  const expiresAt = expires ? Date.parse(expires) : NaN;
  const appwriteMaxAge = Number.isFinite(expiresAt)
    ? Math.max(1, Math.floor((expiresAt - Date.now()) / 1000))
    : SESSION_COOKIE_FALLBACK_MAX_AGE_SECONDS;
  const maxAge = persistent ? appwriteMaxAge : undefined;

  response.cookies.set(AUTH_SESSION_COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax permits the OAuth provider's top-level redirect back to LinkFlow.
    sameSite: "lax",
    path: "/",
    ...(maxAge
      ? {
          maxAge,
          expires: Number.isFinite(expiresAt)
            ? new Date(expiresAt)
            : new Date(Date.now() + maxAge * 1000),
        }
      : {}),
  });
}

/**
 * Dispara o email de verificação de email do Appwrite para a sessão dada
 * (createVerification). O Appwrite envia SEMPRE o seu próprio email (template
 * da consola — Branding → Email Templates → Verification) com o link
 * `{NEXT_PUBLIC_SITE_URL}/verify-email?userId=..&secret=..`. O secret do token
 * só é conhecido do Appwrite (vai no email), por isso não é possível enviar um
 * email personalizado com o mesmo link sem duplicar o envio do Appwrite.
 * Falhas de envio não devem quebrar o registo — quem chama trata como
 * best-effort.
 */
export async function requestEmailVerification(account: Account): Promise<void> {
  const siteUrl = normalizeEnvUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
    "https://linkflow.workers.dev"
  );
  const verificationUrl = new URL("/verify-email", siteUrl).toString();
  await account.createVerification(verificationUrl);
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

