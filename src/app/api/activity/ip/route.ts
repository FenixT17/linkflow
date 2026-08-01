import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity/ip
 *
 * Devolve o IP real do cliente (derivado dos headers do servidor, nunca do
 * body). Usado pelo registo de "Atividades recentes": o client SDK escreve a
 * atividade no Appwrite, mas só o servidor conhece o IP real do utilizador.
 *
 * Privacidade: o IP é do próprio dono da conta (as suas próprias ações) e
 * nunca é exposto a terceiros — apenas aparece no cartão "Atividades recentes"
 * do próprio utilizador.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);

  // Rate limit: 30 leituras/min por IP é mais que suficiente.
  const rate = checkRateLimit("activity_ip", ip, {
    maxRequests: 30,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return NextResponse.json({ ip });
}
