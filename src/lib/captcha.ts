import "server-only";

import { checkRateLimit, getClientIp, type RateLimitResult } from "@/lib/rate-limit";

interface HCaptchaResponse {
  success?: boolean;
  hostname?: string;
  "error-codes"?: string[];
}

export class CaptchaError extends Error {
  readonly status = 403;

  constructor() {
    super("Verificação anti-bot inválida.");
    this.name = "CaptchaError";
  }
}

export async function verifyHCaptcha(
  request: Request,
  token: unknown,
): Promise<void> {
  const secret = process.env.HCAPTCHA_SECRET?.trim();
  const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();
  if (!secret || !sitekey || typeof token !== "string" || token.length < 10 || token.length > 4096) {
    throw new CaptchaError();
  }

  let response: Response;
  try {
    const form = new URLSearchParams({
      secret,
      response: token,
      sitekey,
    });
    const ip = getClientIp(request);
    if (ip !== "unknown") form.set("remoteip", ip);
    response = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch {
    throw new CaptchaError();
  }

  if (!response.ok) throw new CaptchaError();
  const result = (await response.json().catch(() => null)) as HCaptchaResponse | null;
  if (result?.success !== true) throw new CaptchaError();
}

export async function checkCaptchaRateLimit(request: Request): Promise<RateLimitResult> {
  return checkRateLimit("captcha", getClientIp(request));
}
