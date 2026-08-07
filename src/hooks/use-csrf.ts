/**
 * CSRF token management for the Double Submit Cookie pattern.
 *
 * This module provides:
 * - initCsrfToken(): Initialize the CSRF token (call once on app start)
 * - fetchWithCsrf(): Fetch wrapper that automatically includes the CSRF header
 * - getCsrfCookieFromDocument(): Read the CSRF token directly from the cookie
 *
 * Uses the browser's built-in fetch API — no React dependencies needed.
 */

const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-linkflow-csrf" : "csrf-token";

/**
 * Lê o token CSRF diretamente da cookie do navegador.
 * Isto garante que usamos sempre o valor atual da cookie,
 * evitando desyncs entre o token em memória e a cookie.
 */
export function getCsrfCookieFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const escapedName = CSRF_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Busca um token CSRF do servidor e retorna-o.
 * O servidor também define o token como cookie.
 */
async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf", {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch CSRF token");
  }
  const data = await res.json();
  return data.token as string;
}

/**
 * Para uso em componentes não-React (ex: services.ts).
 * O módulo mantém uma referência ao token atual.
 * O módulo mantém uma referência ao token atual.
 */
let tokenRef: string | null = null;
let tokenPromise: Promise<string> | null = null;

/**
 * Inicializa o token CSRF (chamar no arranque da app).
 * Pode ser chamado várias vezes — só faz fetch uma vez.
 */
export function initCsrfToken(): Promise<string> {
  if (tokenRef) return Promise.resolve(tokenRef);
  if (tokenPromise) return tokenPromise;

  tokenPromise = fetchCsrfToken()
    .then((t) => {
      tokenRef = t;
      return t;
    })
    .catch((err) => {
      console.error("[CSRF] init failed:", err);
      tokenRef = "__missing__";
      return "__missing__";
    });

  return tokenPromise;
}

/**
 * Força a renovação do token CSRF — útil após login para prevenir
 * session fixation. Limpa o token em memória e faz um novo fetch.
 */
export function refreshCsrfToken(): Promise<string> {
  tokenRef = null;
  tokenPromise = null;
  return initCsrfToken();
}

/**
 * Limpa o token CSRF da memória e do cookie do navegador.
 * Usar durante o logout para impedir reutilização.
 * Nota: o servidor também deve ser chamado (DELETE /api/csrf) para
 * limpar o cookie com HttpOnly se aplicável.
 */
export function clearCsrfToken(): void {
  tokenRef = null;
  tokenPromise = null;
  // Remove o cookie CSRF do navegador
  if (typeof document !== "undefined") {
    document.cookie = `${CSRF_COOKIE_NAME}=; path=/; max-age=0`;
  }
}

/**
 * Fetch wrapper com CSRF para usar em módulos de serviço.
 * Inicializa o token automaticamente se necessário.
 * Usar em chamadas fetch a API routes do próprio domínio.
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Tenta ler o token da cookie primeiro (mais atualizado)
  let t = getCsrfCookieFromDocument();
  
  // Fallback para o token em memória
  if (!t) {
    t = tokenRef || (await initCsrfToken());
  }

  // Fail-closed (M2 da auditoria): se o token CSRF não estiver disponível,
  // NÃO degradar silenciosamente para um pedido sem header CSRF. O chamador
  // decide como reagir (geralmente mostrar erro e pedir reload).
  if (!t || t === "__missing__") {
    throw new Error("CSRF token unavailable. Recarregue a página e tente novamente.");
  }

  const headers = new Headers(options.headers || {});
  headers.set(CSRF_HEADER_NAME, t);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}
