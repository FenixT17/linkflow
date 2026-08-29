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

// Deduplicação do refresh: chamadas concorrentes partilham o MESMO fetch,
// para não rodar a cookie CSRF com tokens diferentes (race que causaria 403).
let refreshPromise: Promise<string> | null = null;

/**
 * Devolve um token CSRF válido garantindo que a cookie está presente e
 * sincronizada com o token enviado (double-submit).
 *
 * - Se a cookie existir, usa o valor dela (a fonte de verdade do servidor).
 * - Se estiver ausente/expirada, força um /api/csrf NOVO (cookie + token
 *   frescos), deduplicado para chamadas concorrentes.
 *
 * Ao contrário de initCsrfToken(), NUNCA devolve um tokenRef em memória que
 * possa estar dessincronizado da cookie — ex: cookie expirada com a SPA
 * aberta, ou tokenRef travado em "__missing__" após uma falha transitória.
 * Nesses casos o header era enviado sem cookie correspondente (ou nem era
 * enviado) e o proxy devolvia 403 "CSRF token inválido ou ausente".
 */
export function ensureCsrfToken(): Promise<string> {
  const cookieToken = getCsrfCookieFromDocument();
  if (cookieToken) return Promise.resolve(cookieToken);

  if (!refreshPromise) {
    refreshPromise = fetchCsrfToken()
      .catch(() => "__missing__")
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
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
  // Lê a cookie (fonte de verdade) ou força um refresh se ausente — garante
  // que o header bate sempre com a cookie (ver ensureCsrfToken).
  const t = await ensureCsrfToken();

  // Fail-closed (M2 da auditoria): se o token CSRF não estiver disponível,
  // NÃO degradar silenciosamente para um pedido sem header CSRF. O chamador
  // decide como reagir (geralmente mostrar erro e pedir reload).
  if (!t || t === "__missing__") {
    throw new Error("CSRF token unavailable. Recarregue a página e tente novamente.");
  }

  const headers = new Headers(options.headers || {});
  headers.set(CSRF_HEADER_NAME, t);
  if (!headers.has("Content-Type")) {
    // Never set application/json for browser-managed bodies. In particular,
    // FormData must keep its multipart boundary; forcing JSON here makes
    // request.formData() fail and breaks image uploads.
    const body = options.body;
    const browserManagedBody =
      (typeof FormData !== "undefined" && body instanceof FormData) ||
      (typeof Blob !== "undefined" && body instanceof Blob) ||
      (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) ||
      body instanceof ArrayBuffer ||
      (typeof ReadableStream !== "undefined" && body instanceof ReadableStream);
    if (!browserManagedBody) {
      headers.set("Content-Type", "application/json");
    }
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}
