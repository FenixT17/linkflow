/**
 * Helpers para parsear e traduzir erros do fluxo OAuth2 (Appwrite).
 *
 * Quando o Appwrite Cloud falha o OAuth, ele redireciona para a failure URL
 * com o erro codificado no query param `error` — e o `error_description`
 * vem normalmente VAZIO. O `error` pode ser:
 *
 *   - um JSON URL-encoded (Appwrite Cloud):
 *       ?error=%7B%22message%22%3A%22A+user+with+the+same+id...+%22%2C%22type%22%3A%22user_already_exists%22%2C%22code%22%3A409%7D
 *   - um código simples (ex: `provider_disabled`).
 *
 * Sem este parser, a página mostrava sempre a mensagem genérica
 * "Falha na autenticação." mesmo quando o erro real era `user_already_exists`.
 */

export interface ParsedOAuthError {
  /** Código/tipo do erro Appwrite (ex: "user_already_exists", "provider_disabled"). */
  type: string;
  /** Mensagem crua do erro (do JSON ou do error_description). */
  message: string;
  /** Mensagem amigável em português para mostrar ao utilizador. */
  friendly: string;
}

/** Tenta extrair { type, message } de um valor que pode ser JSON URL-encoded. */
function extractErrorPayload(raw: string | null): { type: string; message: string } {
  if (!raw) return { type: "", message: "" };

  let decoded = raw;
  // O Appwrite Cloud pode codificar o JSON — decodifica uma vez se necessário.
  try {
    if (decoded.includes("%")) {
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // mantém o valor original se a decodificação falhar
  }

  try {
    const parsed = JSON.parse(decoded) as { type?: unknown; message?: unknown };
    return {
      type: typeof parsed.type === "string" ? parsed.type : "",
      message: typeof parsed.message === "string" ? parsed.message : "",
    };
  } catch {
    // Não é JSON — é um código de erro simples (ex: "provider_disabled").
    return { type: decoded, message: "" };
  }
}

/**
 * Converte o erro OAuth (query params `error` + `error_description`) numa
 * mensagem amigável em português. Devolve null se não houver erro para mostrar.
 */
export function parseOAuthError(errorParam: string | null, errorDescription: string | null): ParsedOAuthError | null {
  if (!errorParam) return null;

  const { type, message } = extractErrorPayload(errorParam);

  // error_description pode vir preenchido em alguns setups — dá-lhe prioridade.
  let messageText = "";
  if (errorDescription) {
    try {
      messageText = decodeURIComponent(errorDescription);
    } catch {
      messageText = errorDescription;
    }
  }
  if (!messageText) messageText = message;
  // Fallback: mostra o tipo/código (ex: "unexpected_error") em vez de uma
  // mensagem vazia genérica — o utilizador vê o erro real.
  if (!messageText) messageText = type || "Falha na autenticação.";

  // Normaliza o haystack para conter TANTO as formas com underscore (tipos
  // Appwrite: user_already_exists, session_already_exists) COMO com espaços.
  const raw = `${type} ${messageText}`.toLowerCase();
  const haystack = `${raw} ${raw.replace(/_/g, " ")}`;

  // Casos conhecidos → mensagens específicas em português.
  // ORDEM IMPORTANTE: o mais específico primeiro. Se o check de user viesse
  // antes, o "already exists" genérico engoliria o "session already exists"
  // normalizado (o tipo Appwrite session_already_exists tem underscore).
  if (
    haystack.includes("session_already_exists") ||
    haystack.includes("session already exists") ||
    haystack.includes("session is active")
  ) {
    return {
      type,
      message: messageText,
      friendly: "Já existe uma sessão ativa. Termine a sessão atual antes de entrar com outro método.",
    };
  }

  if (
    haystack.includes("user_already_exists") ||
    haystack.includes("user already exists") ||
    haystack.includes("user with the same id")
  ) {
    return {
      type,
      message: messageText,
      friendly:
        "Já existe uma conta com este email. Entre com email e palavra-passe (ou termine a sessão atual e tente novamente).",
    };
  }

  // Restrito ao contexto do provider para não dar mensagem errada para
  // "user_disabled" (utilizador desativado ≠ provider desativado).
  if (
    haystack.includes("provider_disabled") ||
    haystack.includes("provider not found") ||
    haystack.includes("provider disabled") ||
    haystack.includes("provider is disabled")
  ) {
    return {
      type,
      message: messageText,
      friendly: "O provedor de login está desativado no Appwrite. Tente outro método.",
    };
  }

  if (
    haystack.includes("access_denied") ||
    haystack.includes("access denied") ||
    haystack.includes("cancelled") ||
    haystack.includes("canceled")
  ) {
    return {
      type,
      message: messageText,
      friendly: "Autenticação cancelada ou sem permissão no provedor externo.",
    };
  }

  // Fallback: mostra a mensagem real do provedor/Appwrite (já não "Falha na autenticação.").
  return { type, message: messageText, friendly: `OAuth falhou: ${messageText}` };
}
