/**
 * Helpers para "lembrar" o último email conhecido do utilizador no browser.
 *
 * Contexto: quando o OAuth falha com `user_already_exists`, o Appwrite NÃO
 * devolve o email do utilizador no erro (por privacidade). Para pré-preencher
 * o formulário de login, guardamos o último email usado (login/registo) em
 * localStorage e recuperamos quando o fluxo OAuth volta com esse erro.
 */

const EMAIL_HINT_KEY = "linkflow_last_email";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Extrai um email de um texto arbitrário (defensivo — se o Appwrite incluir). */
export function extractEmailFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(EMAIL_REGEX);
  return match ? match[0] : null;
}

/** Guarda o último email conhecido do utilizador (idempotente, nunca falha). */
export function rememberEmail(email: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const extracted = extractEmailFromText(email);
  if (!extracted) return;
  try {
    window.localStorage.setItem(EMAIL_HINT_KEY, extracted);
  } catch {
    // localStorage indisponível (modo privado / quota) — ignora silenciosamente.
  }
}

/** Devolve o último email conhecido, ou "" se não houver. */
export function getLastKnownEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(EMAIL_HINT_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Limpa o email guardado (usado no logout para privacidade). */
export function clearEmailHint(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(EMAIL_HINT_KEY);
  } catch {
    // ignora
  }
}
