import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { normalizeEnvUrl } from "@/lib/utils";
import { sendVerificationEmail } from "@/lib/mailersend.server";

const endpoint = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://cloud.appwrite.io/v1"
);
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const apiKey = process.env.APPWRITE_API_KEY ?? "";

/**
 * Validade do token de confirmação de email (7 dias — o mesmo prazo padrão
 * dos tokens de verificação do Appwrite). Guarda-se apenas o hash; o token
 * cru vai exclusivamente no email (MailerSend).
 */
export const VERIFICATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PREFS_HASH_KEY = "verificationTokenHash";
const PREFS_EXPIRE_KEY = "verificationTokenExpire";

export class VerificationError extends Error {
  readonly code: "invalid_link" | "expired_link" | "unavailable";
  readonly status: number;

  constructor(
    code: "invalid_link" | "expired_link" | "unavailable",
    message: string,
    status = 400
  ) {
    super(message);
    this.name = "VerificationError";
    this.code = code;
    this.status = status;
  }
}

/**
 * PORQUE é que a verificação usa um token próprio em vez do createVerification
 * oficial do Appwrite: neste projeto (Appwrite Cloud 1.9.x) o `secret` do token
 * é REDIGIDO na resposta (`secret: ""` — confirmado empiricamente) e só existe
 * dentro do email que o próprio Appwrite envia; não existe endpoint admin que
 * crie o token sem enviar o email (POST /users/{id}/verification → 404). Ou
 * seja, sem o token cru não conseguimos incluir o link real num email do
 * MailerSend. Mantemos o Appwrite como dono do ESTADO (a flag emailVerification
 * é marcada pelo endpoint admin oficial PATCH /users/{id}/verification); só a
 * entrega do email passa a ser do MailerSend, com um token de alto entropia
 * gerado por nós, guardado como hash nas prefs do utilizador.
 */

/** Hash SHA-256 do token (nunca guardamos o token cru). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparação em tempo constante (consistente com o csrf.ts). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Gera um token de verificação de alto entropia (256 bits, base64url). */
export function createVerificationToken(): { token: string; tokenHash: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString(),
  };
}

export function isValidUserId(userId: string): boolean {
  return /^[a-zA-Z0-9._-]{1,36}$/.test(userId);
}

export function isValidVerificationToken(token: string): boolean {
  return (
    typeof token === "string" &&
    token.length >= 32 &&
    token.length <= 256 &&
    /^[a-zA-Z0-9_-]+$/.test(token)
  );
}

/**
 * Compara o token apresentado com o estado guardado (hash + expiração).
 * Puro e testável sem rede.
 */
export function verifyTokenMatch(
  token: string,
  stored: { hash?: string; expiresAt?: string } | null
): "valid" | "invalid" | "expired" | "missing" {
  if (!stored?.hash) return "missing";
  if (!isValidVerificationToken(token)) return "invalid";
  if (!safeEqual(hashToken(token), stored.hash)) return "invalid";
  const expiresAt = stored.expiresAt ? Date.parse(stored.expiresAt) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return "expired";
  return "valid";
}

/** Chamada REST de admin ao Appwrite (API key do servidor — nunca no cliente). */
async function adminRequest<T>(
  path: string,
  method: "GET" | "PATCH",
  body?: unknown
): Promise<T> {
  if (!projectId || !apiKey) {
    throw new VerificationError(
      "unavailable",
      "Serviço de verificação indisponível.",
      503
    );
  }
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: {
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    // Log do detalhe técnico APENAS no servidor; o cliente recebe sempre uma
    // mensagem genérica (nunca mensagens cruas do provider nem detalhes internos).
    const providerMessage =
      typeof data.message === "string" ? data.message : `HTTP ${response.status}`;
    console.warn("[Verification] Falha na operação de admin no Appwrite", {
      path,
      status: response.status,
      providerMessage: providerMessage.slice(0, 300),
    });
    throw new VerificationError(
      "unavailable",
      "Serviço de verificação indisponível.",
      response.status
    );
  }
  return data as T;
}

export async function storeVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: string
): Promise<void> {
  await adminRequest(`/users/${userId}/prefs`, "PATCH", {
    prefs: { [PREFS_HASH_KEY]: tokenHash, [PREFS_EXPIRE_KEY]: expiresAt },
  });
}

export async function getStoredVerificationToken(
  userId: string
): Promise<{ hash?: string; expiresAt?: string }> {
  const prefs = await adminRequest<Record<string, unknown>>(
    `/users/${userId}/prefs`,
    "GET"
  );
  return {
    hash: typeof prefs[PREFS_HASH_KEY] === "string" ? (prefs[PREFS_HASH_KEY] as string) : undefined,
    expiresAt:
      typeof prefs[PREFS_EXPIRE_KEY] === "string" ? (prefs[PREFS_EXPIRE_KEY] as string) : undefined,
  };
}

export async function clearStoredVerificationToken(userId: string): Promise<void> {
  await adminRequest(`/users/${userId}/prefs`, "PATCH", {
    prefs: { [PREFS_HASH_KEY]: "", [PREFS_EXPIRE_KEY]: "" },
  });
}

/** Marca o email como verificado através do endpoint ADMIN oficial do Appwrite. */
export async function markEmailVerified(userId: string): Promise<void> {
  await adminRequest(`/users/${userId}/verification`, "PATCH", {
    emailVerification: true,
  });
}

export async function getUserEmailVerificationState(userId: string): Promise<boolean> {
  try {
    const user = await adminRequest<{ emailVerification?: unknown }>(
      `/users/${userId}`,
      "GET"
    );
    return user.emailVerification === true;
  } catch (error) {
    // Utilizador inexistente (ex.: link de um utilizador apagado) → link
    // inválido, não um erro do serviço.
    if (error instanceof VerificationError && error.status === 404) {
      throw new VerificationError("invalid_link", "Link de verificação inválido.", 400);
    }
    throw error;
  }
}

export interface IssueEmailVerificationInput {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Gera um novo processo de verificação: cria o token, guarda o hash nas prefs
 * e envia o email através do MailerSend. Lança em caso de falha — os callers
 * (registo/reenvio) tratam como best-effort e nunca quebram a operação principal.
 */
export async function issueEmailVerification({
  userId,
  email,
  name,
}: IssueEmailVerificationInput): Promise<{ sent: boolean }> {
  const { token, tokenHash, expiresAt } = createVerificationToken();
  await storeVerificationToken(userId, tokenHash, expiresAt);

  const siteUrl = normalizeEnvUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
    "https://linkflow.workers.dev"
  );
  const verificationUrl = `${siteUrl}/verify-email?userId=${encodeURIComponent(
    userId
  )}&token=${encodeURIComponent(token)}`;

  await sendVerificationEmail({ to: email, name, verificationUrl });
  return { sent: true };
}

export interface ConfirmVerificationInput {
  userId: string;
  token: string;
}

/**
 * Valida o token apresentado (hash + expiração, single-use) e marca o email
 * como verificado no Appwrite. O estado final é SEMPRE o do Appwrite.
 */
export async function confirmVerificationToken({
  userId,
  token,
}: ConfirmVerificationInput): Promise<{ verified: boolean }> {
  if (!isValidUserId(userId) || !isValidVerificationToken(token)) {
    throw new VerificationError("invalid_link", "Link de verificação inválido.", 400);
  }

  let alreadyVerified: boolean;
  try {
    alreadyVerified = await getUserEmailVerificationState(userId);
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw new VerificationError("unavailable", "Não foi possível confirmar o email.", 502);
  }
  // Idempotente: clicar num link antigo quando o email já está verificado não
  // é erro — o utilizador já completou o objetivo.
  if (alreadyVerified) return { verified: true };

  let stored: { hash?: string; expiresAt?: string };
  try {
    stored = await getStoredVerificationToken(userId);
  } catch {
    throw new VerificationError("unavailable", "Não foi possível confirmar o email.", 502);
  }

  const match = verifyTokenMatch(token, stored);
  if (match === "missing" || match === "invalid") {
    throw new VerificationError(
      "invalid_link",
      "Link de verificação inválido ou já utilizado.",
      400
    );
  }
  if (match === "expired") {
    throw new VerificationError(
      "expired_link",
      "O link de verificação expirou. Pede um novo email.",
      400
    );
  }

  try {
    // Marca primeiro (a flag é o estado canónico); limpar o hash é idempotente
    // e uma falha aqui não bloqueia a verificação já concluída.
    await markEmailVerified(userId);
    await clearStoredVerificationToken(userId).catch(() => {});
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw new VerificationError("unavailable", "Não foi possível confirmar o email. Tenta novamente.", 502);
  }
  return { verified: true };
}
