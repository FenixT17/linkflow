import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { createServerAuthClient } from "@/lib/auth.server";
import { normalizeEnvUrl } from "@/lib/utils";
import { isValidEmail } from "@/lib/sanitize";

const GENERIC_RESPONSE = {
  sent: true,
  message: "Se existir uma conta com esse email, receberá instruções para recuperar a palavra-passe.",
};

export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  let rateLimit;
  try {
    rateLimit = await checkRateLimit("passwordReset", getClientIp(request));
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }

  let email = "";
  try {
    const body = await request.json() as { email?: unknown };
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    // Mantém a resposta genérica para não transformar a rota num oracle de contas.
  }

  if (isValidEmail(email)) {
    try {
      const { account } = createServerAuthClient();
      const siteUrl = normalizeEnvUrl(
        process.env.NEXT_PUBLIC_SITE_URL,
        "https://linkflow.workers.dev",
      );
      // O Appwrite envia o email oficial e cria o token de recuperação.
      // A consola Appwrite deve ter SMTP/template configurados. Não usamos
      // também email.server.ts: a API não permite gerar o token sem disparar
      // o email integrado, e duplicar o envio confundiria o utilizador.
      await account.createRecovery(email, new URL("/reset-password", siteUrl).toString());
    } catch (error) {
      // Erros de email inexistente, provider ou configuração têm a mesma
      // resposta pública para impedir enumeração de contas.
      console.warn("[PasswordReset] Pedido não concluído:", error instanceof Error ? error.name : "unknown");
    }
  }

  return NextResponse.json(GENERIC_RESPONSE, {
    headers: mergeRateLimitHeaders(undefined, rateLimit),
  });
}
