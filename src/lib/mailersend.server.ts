import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { renderMailerSendVerificationEmail } from "@/lib/email-templates";

const MAILERSEND_API_URL = "https://api.mailersend.com/v1/email";

/** Remetente autorizado e verificado na conta MailerSend do LinkFlow. */
export const MAILERSEND_DEFAULT_FROM_EMAIL = "info@test-69oxl5ekp92l785k.mlsender.net";
const MAILERSEND_SENDER_NAME = "LinkFlow";

export class MailerSendError extends Error {
  readonly code:
    | "NOT_CONFIGURED"
    | "UNAUTHORIZED"
    | "INVALID_PAYLOAD"
    | "RATE_LIMITED"
    | "SEND_FAILED";
  readonly status: number;

  constructor(
    code:
      | "NOT_CONFIGURED"
      | "UNAUTHORIZED"
      | "INVALID_PAYLOAD"
      | "RATE_LIMITED"
      | "SEND_FAILED",
    message: string,
    status = 502
  ) {
    super(message);
    this.name = "MailerSendError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Lê o token da API do MailerSend.
 *
 * Cloudflare Workers: lido EXCLUSIVAMENTE via `env` (bindings do Worker) —
 * `getCloudflareContext().env.MAILERSEND_API_TOKEN`. Nunca `process.env` neste
 * runtime (embora nodejs_compat o exponha, a leitura oficial do adaptador é
 * `env` e é essa que usamos).
 *
 * Fallback para `process.env` APENAS fora do Worker (next dev / vitest) para
 * o fluxo local funcionar com um .env.local gitignored.
 *
 * O token nunca é exposto ao bundle do cliente (módulo server-only), nunca é
 * registado em logs e nunca é commitado.
 */
export async function getMailerSendApiToken(): Promise<string> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const token = (env as Record<string, unknown>).MAILERSEND_API_TOKEN;
    if (typeof token === "string" && token.trim()) return token.trim();
  } catch {
    // Fora do adaptador OpenNext Cloudflare (dev/testes).
  }
  return process.env.MAILERSEND_API_TOKEN?.trim() ?? "";
}

function mapStatus(status: number): MailerSendError["code"] {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 400 || status === 422) return "INVALID_PAYLOAD";
  if (status === 429) return "RATE_LIMITED";
  return "SEND_FAILED";
}

export interface SendVerificationEmailInput {
  to: string;
  name?: string;
  verificationUrl: string;
}

/**
 * Envia o email de confirmação através da API REST do MailerSend (fetch
 * direto — sem dependências extra, compatível com Cloudflare Workers).
 *
 * Só considera o envio bem-sucedido com HTTP 2xx E `x-message-id` presente —
 * um 2xx sem confirmação é tratado como falha. Nunca regista o token.
 */
export async function sendVerificationEmail(
  input: SendVerificationEmailInput
): Promise<{ messageId: string }> {
  const token = await getMailerSendApiToken();
  if (!token) {
    throw new MailerSendError(
      "NOT_CONFIGURED",
      "MAILERSEND_API_TOKEN não está configurado no Worker.",
      503
    );
  }

  const fromEmail =
    process.env.MAILERSEND_FROM_EMAIL?.trim() || MAILERSEND_DEFAULT_FROM_EMAIL;
  const { subject, html, text } = renderMailerSendVerificationEmail(
    { name: input.name },
    input.verificationUrl
  );

  const response = await fetch(MAILERSEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: MAILERSEND_SENDER_NAME },
      to: [{ email: input.to }],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const providerBody = await response.text().catch(() => "");
    // Log seguro: status + mensagem do provider, NUNCA o token.
    console.error("[MailerSend] Falha no envio do email de verificação", {
      status: response.status,
      providerMessage: providerBody.slice(0, 300),
    });
    throw new MailerSendError(
      mapStatus(response.status),
      "O serviço de email rejeitou o envio.",
      response.status === 401 ? 502 : response.status
    );
  }

  const messageId = response.headers.get("x-message-id")?.trim() ?? "";
  if (!messageId) {
    console.error(
      "[MailerSend] Envio sem confirmação — x-message-id ausente na resposta"
    );
    throw new MailerSendError(
      "SEND_FAILED",
      "O serviço de email não confirmou o envio.",
      502
    );
  }

  console.info("[MailerSend] Email de verificação enviado", { messageId });
  return { messageId };
}
