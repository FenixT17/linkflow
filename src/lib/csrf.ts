/**
 * CSRF Protection — Double Submit Cookie pattern.
 *
 * How it works:
 * 1. Client fetches GET /api/csrf to get a token.
 * 2. Server sets the token as an httpOnly cookie AND returns it in the response body.
 * 3. Client stores the token in memory and includes it as X-CSRF-Token header on mutating requests.
 * 4. Server validates that the header value matches the cookie value.
 *
 * This works because:
 * - Browsers block custom headers (X-CSRF-Token) on cross-origin requests (no CORS preflight for simple requests)
 * - An attacker cannot read the CSRF cookie from a different origin
 * - An attacker cannot forge the header value
 */

import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_COOKIE_MAX_AGE = 60 * 60; // 1 hour

/**
 * Gera um token CSRF aleatório.
 * Usa crypto web API para ser compatível com Edge Runtime.
 */
export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Define o cookie CSRF na resposta.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be false for Double Submit Cookie pattern (client reads it)
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
    maxAge: CSRF_COOKIE_MAX_AGE,
  });
}

/**
 * Valida o token CSRF de um request.
 * Compara o valor do cookie com o header X-CSRF-Token.
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const cookieValue = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerValue = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieValue || !headerValue) {
    return false;
  }

  // Use timing-safe comparison when available
  try {
    // Constant-time comparison to prevent timing attacks
    const cookieBuf = new TextEncoder().encode(cookieValue);
    const headerBuf = new TextEncoder().encode(headerValue);

    if (cookieBuf.length !== headerBuf.length) return false;

    let result = 0;
    for (let i = 0; i < cookieBuf.length; i++) {
      result |= cookieBuf[i] ^ headerBuf[i];
    }
    return result === 0;
  } catch {
    return cookieValue === headerValue;
  }
}

/**
 * Middleware-style wrapper para validar CSRF em API routes.
 * Usa nos métodos POST, PUT, DELETE, PATCH.
 *
 * Uso:
 *   export async function POST(request: NextRequest) {
 *     const csrfCheck = csrfGuard(request);
 *     if (csrfCheck) return csrfCheck;
 *     // ... handler logic
 *   }
 */
export function csrfGuard(request: NextRequest): NextResponse | null {
  // Skip CSRF check for same-origin GET/HEAD/OPTIONS
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return null;
  }

  if (!validateCsrfToken(request)) {
    return NextResponse.json(
      { error: "CSRF token inválido ou ausente. Recarregue a página e tente novamente." },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Limpa o cookie CSRF da resposta.
 * Usar no logout para garantir que o token não pode ser reutilizado.
 */
export function clearCsrfCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set(CSRF_COOKIE_NAME, "", {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
    maxAge: 0, // Expira imediatamente
  });
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
