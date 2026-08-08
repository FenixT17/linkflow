import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import {
  confirmVerificationToken,
  VerificationError,
} from "@/lib/verification.server";

/**
 * POST /api/auth/verify-email — confirma o email a partir do link enviado no
 * email (MailerSend): `{ userId, token }`.
 *
 * Autenticação: NÃO usa CSRF nem sessão — o próprio token (256 bits,
 * single-use, hashed + com expiração guardada no Appwrite) é a credencial.
 * Um utilizador que clica no link de um email fá-lo num browser possivelmente
 * novo, sem cookie CSRF — exigir CSRF aqui partiria o fluxo. Proteção de abuso:
 * rate limit por IP (20 pedidos / 10 min) + token de alta entropia (brute-force
 * inviável) + consumo do token na primeira utilização.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimit("verify_email_confirm", ip, {
      maxRequests: 20,
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

  let body: { userId?: unknown; token?: unknown };
  try {
    const raw = await request.text();
    body = raw.length <= 4096 ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    body = {};
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const token = typeof body.token === "string" ? body.token : "";

  try {
    await confirmVerificationToken({ userId, token });
    return NextResponse.json(
      { verified: true },
      { headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  } catch (error) {
    if (error instanceof VerificationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: mergeRateLimitHeaders(undefined, rateLimit) },
      );
    }
    console.warn("[VerifyEmail] Falha ao confirmar email:", error);
    return NextResponse.json(
      { error: "Não foi possível confirmar o email. Tenta novamente mais tarde." },
      { status: 502, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }
}
