import { NextRequest, NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { createEmailPasswordSessionResolved, createPublicAuthClient, setAuthSessionCookie } from "@/lib/auth.server";
import { isValidEmail, isValidPassword, sanitizeDisplayName } from "@/lib/sanitize";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_NAME_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 256;

function bodyTooLarge(request: NextRequest): boolean {
  const length = request.headers.get("content-length");
  return length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES);
}

export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;
  if (bodyTooLarge(request)) {
    return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
  }

  const ip = getClientIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimit("register", ip);
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Limite de registos atingido. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
    }
    const body = (() => {
      try {
        return JSON.parse(rawBody) as { email?: unknown; password?: unknown; name?: unknown };
      } catch {
        return null;
      }
    })();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? sanitizeDisplayName(body.name) : "";

    if (
      !isValidEmail(email) ||
      email.length > MAX_EMAIL_LENGTH ||
      !name ||
      name.length > MAX_NAME_LENGTH ||
      !isValidPassword(password) ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return NextResponse.json({ error: "Dados de registo inválidos." }, { status: 400 });
    }

    const { account } = createPublicAuthClient();
    const user = await account.create(ID.unique(), email, password, name);
    const session = await createEmailPasswordSessionResolved(email, password);
    const response = NextResponse.json(
      { user: { $id: user.$id, email: user.email, name: user.name, $createdAt: user.$createdAt } },
      { status: 201, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
    setAuthSessionCookie(response, session.secret, session.expire);
    return response;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: number }).code
      : undefined;
    const type = typeof error === "object" && error !== null && "type" in error
      ? String((error as { type?: unknown }).type ?? "")
      : "";
    const status = code === 429 ? 429 : 400;
    const message = code === 429
      ? "Muitas tentativas. Aguarde antes de tentar novamente."
      : type.includes("user_already_exists") || code === 409
        ? "Este email já tem uma conta. Tente entrar ou use outro email."
        : "Não foi possível criar a conta.";
    return NextResponse.json({ error: message }, { status, headers: mergeRateLimitHeaders(undefined, rateLimit) });
  }
}
