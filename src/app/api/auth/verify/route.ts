import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth.server";
import { issueEmailVerification } from "@/lib/verification.server";

/**
 * POST /api/auth/verify — reenvia o email de verificação de email (MailerSend)
 * para o utilizador autenticado (best-effort). Usado a partir das páginas
 * /verify-email e /verify-email/sent ("Reenviar email").
 */
export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const ip = getClientIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimit("verify_email", ip, {
      maxRequests: 5,
      windowMs: 10 * 60 * 1000,
    });
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitos pedidos. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await issueEmailVerification({
      userId: auth.user.$id,
      email: auth.user.email,
      name: auth.user.name,
    });
    return NextResponse.json({ sent: true }, { headers: mergeRateLimitHeaders(undefined, rateLimit) });
  } catch (error) {
    console.warn("[Verify] Falha ao enviar email de verificação:", error);
    return NextResponse.json(
      { error: "Não foi possível enviar o email de verificação. Tente novamente mais tarde." },
      { status: 502, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }
}
