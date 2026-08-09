import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { createEmailPasswordSessionResolved, setAuthSessionCookie } from "@/lib/auth.server";
import { CaptchaError, checkCaptchaRateLimit, verifyHCaptcha } from "@/lib/captcha";

const MAX_BODY_BYTES = 8 * 1024;
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
    rateLimit = await checkRateLimit("login", ip);
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }

  let captchaRateLimit;
  try {
    captchaRateLimit = await checkCaptchaRateLimit(request);
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!captchaRateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas verificações anti-bot. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, captchaRateLimit) },
    );
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
    }
    const body = (() => {
      try {
        return JSON.parse(rawBody) as {
          email?: unknown;
          password?: unknown;
          remember?: unknown;
          captchaToken?: unknown;
        };
      } catch {
        return null;
      }
    })();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    // "Lembrar-me" — default true: a sessão persiste após fechar o browser.
    // Só um booleano `false` explícito desativa a persistência (evita que
    // valores como "false"/0/null sejam tratados como persistentes).
    const remember = typeof body?.remember === "boolean" ? body.remember : true;
    try {
      await verifyHCaptcha(request, body?.captchaToken);
    } catch (error) {
      if (error instanceof CaptchaError) {
        return NextResponse.json({ error: "Conclua a verificação anti-bot e tente novamente." }, { status: error.status });
      }
      throw error;
    }

    if (!email || email.length > MAX_EMAIL_LENGTH || password.length < 1 || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 400 });
    }

      let accountRateLimit;
    try {
      accountRateLimit = await checkRateLimit("login_account", email, {
        maxRequests: 10,
        windowMs: 15 * 60 * 1000,
      });
    } catch {
      return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
    }
    if (!accountRateLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas para esta conta. Aguarde antes de tentar novamente." },
        { status: 429, headers: mergeRateLimitHeaders(undefined, accountRateLimit) },
      );
    }

    const session = await createEmailPasswordSessionResolved(email, password);
    const response = NextResponse.json(
      { user: { $id: session.userId, email } },
      { headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
    setAuthSessionCookie(response, session.secret, session.expire, remember);
    return response;
  } catch (error) {
    const status = typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 429
      ? 429
      : 401;
    return NextResponse.json(
      { error: status === 429 ? "Muitas tentativas. Aguarde antes de tentar novamente." : "Email ou palavra-passe incorretos." },
      { status, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }
}
