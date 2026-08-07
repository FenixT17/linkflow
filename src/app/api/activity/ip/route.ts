import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity/ip
 *
 * O endpoint permanece protegido por sessão e por rate limiting distribuído.
 * Só devolve o IP ao próprio utilizador autenticado, para manter a atividade
 * da conta compatível sem expor este dado publicamente.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ip = getClientIp(request);
  const rate = await checkRateLimit("activity_ip", `${auth.user.$id}:${ip}`, {
    maxRequests: 30,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rate) },
    );
  }

  return NextResponse.json(
    { ip },
    { headers: mergeRateLimitHeaders(undefined, rate) },
  );
}
