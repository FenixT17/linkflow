import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { csrfGuard } from "@/lib/csrf";

/**
 * POST /api/auth/rate-check
 *
 * Checks rate limit for login or register actions by IP.
 * This endpoint MUST be called before attempting login/register
 * via the Appwrite SDK — the client cannot be trusted to rate-limit itself.
 *
 * Returns:
 *  200 { allowed: true } — proceed with login/register
 *  429 { allowed: false, error: "..." } — rate limited, block the attempt
 *
 * Rate limits:
 *  - login: 5 attempts per minute per IP
 *  - register: 3 accounts per hour per IP
 */
export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  try {
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "";

    if (action !== "login" && action !== "register" && action !== "passwordReset") {
      return NextResponse.json(
        { allowed: false, error: "Ação inválida." },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const result = checkRateLimit(action, ip);

    if (!result.allowed) {
      const waitSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
      const message =
        action === "login"
          ? `Muitas tentativas de login. Aguarde ${waitSeconds}s antes de tentar novamente.`
          : action === "register"
            ? `Limite de registos atingido. Aguarde ${Math.ceil(waitSeconds / 60)}min antes de tentar novamente.`
            : `Muitos pedidos de recuperação. Aguarde ${Math.ceil(waitSeconds / 60)}min antes de tentar novamente.`;

      return NextResponse.json(
        { allowed: false, error: message },
        {
          status: 429,
          headers: { "Retry-After": String(waitSeconds) },
        }
      );
    }

    return NextResponse.json({ allowed: true });
  } catch {
    // Fail closed — if we can't check rate limits, block the attempt
    return NextResponse.json(
      { allowed: false, error: "Não foi possível verificar o limite de tentativas. Tente novamente." },
      { status: 500 }
    );
  }
}
