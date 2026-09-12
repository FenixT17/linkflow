import { createHash } from "node:crypto";
import { Query } from "node-appwrite";
import { NextRequest, NextResponse } from "next/server";
import {
  extractLegacySessionSecret,
  getAuthSessionSecret,
  setAuthSessionCookie,
} from "@/lib/auth.server";
import { csrfGuard } from "@/lib/csrf";
import { filterDocumentBody } from "@/lib/appwrite-fields";
import { normalizeEnvUrl } from "@/lib/utils";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { validateThemePayload } from "@/lib/theme-validation";
import { FREE_PLAN_LINK_LIMIT } from "@/lib/plans";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  isValidIdempotencyKey,
  releaseIdempotencyKey,
} from "@/lib/idempotency.server";

// `normalizeEnvUrl` garante que APPWRITE_ENDPOINT nunca é vazia nem inválida
// (o CI injeta secrets não configurados como string vazia, o que faria
// `new URL(APPWRITE_ENDPOINT)` abaixo lançar TypeError em runtime).
const APPWRITE_ENDPOINT = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://fra.cloud.appwrite.io/v1"
);
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const MAX_PROXY_BODY_BYTES = 10 * 1024 * 1024;

function isOAuthNavigation(path: string[]): boolean {
  return path[0] === "account" && path[1] === "sessions" && path[2] === "oauth2";
}

function isAccountPath(path: string[]): boolean {
  return path[0] === "account";
}

function isPublicAccountPath(path: string[]): boolean {
  return (path[1] === "verification" || path[1] === "recovery") && path.length <= 2;
}

// ---- Validação de propriedade de documentos ------------------------------
//
// As coleções abaixo têm `create: Role.users()` no Appwrite — qualquer
// utilizador autenticado pode CRIAR documentos. Sem validação no proxy, um
// atacante criava documentos com idPagina de OUTRAS páginas (injeção de
// links/temas/analíticas em páginas de terceiros: a renderização pública
// lê por idPagina com API key e nunca valida o dono) ou com idUtilizador
// alheio (spam/impersonação em activity_logs/notifications/subscriptions).
//
// Coleções cujo documento referencia a página do dono (campo idPagina).
const PAGE_REFERENCING_COLLECTIONS = new Set(["links", "themes", "analytics", "qr_codes"]);

// Coleções cujo dono é o próprio utilizador autenticado. Em todos os fluxos
// legítimos o valor vem do servidor (services.ts deriva da sessão) — rejeitar
// qualquer valor que não seja o $id da sessão bloqueia spam/impersonação.
const SELF_REFERENCING_COLLECTIONS: Record<string, string> = {
  pages: "idUtilizador",
  activity_logs: "idUtilizador",
  notifications: "idUtilizador",
  subscriptions: "idUtilizador",
  teams: "idProprietario",
};

function isDocumentPath(path: string[]): boolean {
  return path[0] === "databases" && path[2] === "collections" && path[4] === "documents";
}

/**
 * Scope da chave de idempotência: coleção + sessão (nunca inclui o segredo
 * em claro). Evita que a mesma chave enviada por contas diferentes colida.
 */
function idempotencyScope(path: string[], sessionSecret: string): string {
  const sessionDigest = createHash("sha256").update(sessionSecret, "utf8").digest("hex").slice(0, 16);
  return `create:${path[3]}:${sessionDigest}`;
}

// Timeout nas validações server-side: um fetch pendurado (sem timeout, o
// undici não tem timeout por omissão) deixaria a função à espera até ao
// limite do Netlify e o pedido falharia com "invocation failed" em vez de
// devolver um 403/503 limpo. Ao abortar, o fetch rejeita e os callers
// (todos em try/catch) devolvem null → fail-closed.
const APPWRITE_VALIDATION_TIMEOUT_MS = 4500;

async function fetchAppwriteWithSession(suffix: string, sessionSecret: string): Promise<Response> {
  const base = new URL(APPWRITE_ENDPOINT);
  const target = new URL(`${base.origin}${base.pathname.replace(/\/$/, "")}/${suffix}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPWRITE_VALIDATION_TIMEOUT_MS);
  try {
    return await fetch(target, {
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Session": sessionSecret,
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Serializa queries de listagem no formato exato que o SDK Appwrite envia
 * (queries[0], queries[1], ... — ver Client.flatten no SDK). O formato
 * `queries[]` (sem índice) não é o que o SDK usa e pode ser rejeitado pelo
 * Appwrite Cloud, o que faria as validações devolverem null (fail-closed) e
 * bloquearia a criação de links para utilizadores free.
 *
 * Os VALORES das queries têm de vir do builder do SDK (`Query.equal`,
 * `Query.limit`): desde o Appwrite 2.x são objetos JSON serializados
 * (`{"method":"equal",...}`) e o formato legado `equal("campo","valor")`
 * é rejeitado com "Invalid query: Syntax error" — o que fazia estas
 * validações falharem sempre e bloquear TODAS as criações de links.
 */
function buildListDocumentsUrl(databaseId: string, collectionId: string, queries: string[]): string {
  const params = new URLSearchParams();
  queries.forEach((query, index) => params.append(`queries[${index}]`, query));
  return `databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents?${params.toString()}`;
}

async function getSessionUserId(sessionSecret: string): Promise<string | null> {
  try {
    const res = await fetchAppwriteWithSession("account", sessionSecret);
    if (!res.ok) return null;
    const data = (await res.json()) as { $id?: unknown };
    return typeof data.$id === "string" ? data.$id : null;
  } catch {
    return null;
  }
}

async function getPageOwnerId(databaseId: string, idPagina: string, sessionSecret: string): Promise<string | null> {
  try {
    const suffix =
      `databases/${encodeURIComponent(databaseId)}/collections/pages/documents/${encodeURIComponent(idPagina)}`;
    const res = await fetchAppwriteWithSession(suffix, sessionSecret);
    if (!res.ok) return null;
    const data = (await res.json()) as { idUtilizador?: unknown };
    return typeof data.idUtilizador === "string" ? data.idUtilizador : null;
  } catch {
    return null;
  }
}

/**
 * Valida a propriedade de mutações de documento nas coleções protegidas.
 *
 * - POST (create): o campo dono no body tem de pertencer à sessão
 *   (idPagina de uma página do utilizador, ou idUtilizador/idProprietario
 *   igual ao $id da sessão).
 * - PUT/PATCH: se o body tentar ALTERAR o campo dono, o novo valor tem de
 *   pertencer à sessão; se não o altera, as permissões por documento já
 *   restringem quem pode editar (só o dono dos seus próprios documentos).
 * - DELETE: permissões por documento — o atacante só apaga os seus próprios
 *   documentos, que não afetam terceiros.
 *
 * Devolve null quando a operação é permitida, ou a mensagem do 403.
 * Requests sem sessão não passam aqui (o Appwrite rejeita mutações
 * autenticadas); GET/HEAD/OPTIONS, storage e contas não são documentos.
 */
async function validateDocumentOwnership(
  path: string[],
  method: string,
  jsonBody: Record<string, unknown> | null,
  sessionSecret: string
): Promise<string | null> {
  if (!isDocumentPath(path) || !sessionSecret) return null;
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") return null;

  const collectionId = path[3];
  const data = (jsonBody?.data ?? {}) as Record<string, unknown>;

  if (PAGE_REFERENCING_COLLECTIONS.has(collectionId)) {
    const idPagina = typeof data.idPagina === "string" ? data.idPagina : null;
    // PUT/PATCH sem idPagina no body: o documento mantém a página atual —
    // não há alteração de propriedade (permissões por documento protegem).
    if (method !== "POST" && !idPagina) return null;
    if (!idPagina) return "Pedido inválido.";
    const [userId, pageOwnerId] = await Promise.all([
      getSessionUserId(sessionSecret),
      getPageOwnerId(path[1], idPagina, sessionSecret),
    ]);
    if (!userId || !pageOwnerId || userId !== pageOwnerId) {
      return "Ação não permitida.";
    }
    // Limite de links do plano gratuito — imposto server-side, no único ponto
    // de entrada das escritas do browser (ver nota em enforceFreeLinkLimit).
    if (collectionId === "links" && method === "POST") {
      const limitError = await enforceFreeLinkLimit(path[1], idPagina, pageOwnerId, sessionSecret);
      if (limitError) return limitError;
    }
    return null;
  }

  const ownerField = SELF_REFERENCING_COLLECTIONS[collectionId];
  if (!ownerField) return null;

  const ownerValue = typeof data[ownerField] === "string" ? (data[ownerField] as string) : null;
  if (method !== "POST" && !ownerValue) return null;
  if (!ownerValue) return "Pedido inválido.";
  const userId = await getSessionUserId(sessionSecret);
  return userId && ownerValue === userId ? null : "Ação não permitida.";
}

// ---- Limite de links do plano gratuito (server-side) ----------------------
//
// A coleção `links` tem `create: Role.users()` e o client SDK pode ser
// contornado chamando o proxy diretamente — por isso o limite de links do
// plano free tem de ser verificado AQUI, no único ponto de entrada das
// escritas do browser, e não no client. As consultas usam a sessão (o dono
// lê os seus próprios documentos) e falham fechado: se não for possível
// verificar o plano ou a contagem, o limite aplica-se.

async function getUserPlan(databaseId: string, userId: string, sessionSecret: string): Promise<string | null> {
  try {
    const suffix = buildListDocumentsUrl(databaseId, "users", [
      Query.equal("idUtilizador", userId),
      Query.limit(1),
    ]);
    const res = await fetchAppwriteWithSession(suffix, sessionSecret);
    if (!res.ok) return null;
    const data = (await res.json()) as { documents?: Array<{ plano?: unknown }> };
    const plan = data.documents?.[0]?.plano;
    return typeof plan === "string" && plan.length > 0 ? plan : "free";
  } catch {
    return null;
  }
}

async function countPageLinks(databaseId: string, idPagina: string, sessionSecret: string): Promise<number | null> {
  try {
    const suffix = buildListDocumentsUrl(databaseId, "links", [
      Query.equal("idPagina", idPagina),
      Query.limit(FREE_PLAN_LINK_LIMIT + 1),
    ]);
    const res = await fetchAppwriteWithSession(suffix, sessionSecret);
    if (!res.ok) return null;
    const data = (await res.json()) as { total?: unknown };
    return typeof data.total === "number" ? data.total : null;
  } catch {
    return null;
  }
}

/**
 * Impõe o limite de links do plano gratuito (fail-closed).
 * Devolve a mensagem de erro (→ 403) quando o limite é atingido ou quando
 * não é possível verificar o plano/contagem; null quando é permitido.
 */
async function enforceFreeLinkLimit(
  databaseId: string,
  idPagina: string,
  userId: string,
  sessionSecret: string
): Promise<string | null> {
  const limitMessage =
    `Limite de links do plano Gratuito atingido (máx. ${FREE_PLAN_LINK_LIMIT}). Faça upgrade para adicionar mais.`;
  const [plan, total] = await Promise.all([
    getUserPlan(databaseId, userId, sessionSecret),
    countPageLinks(databaseId, idPagina, sessionSecret),
  ]);
  // Plano não gratuito (e verificável) → sem limite.
  if (plan !== null && plan !== "free") return null;
  // Fail-closed: contagem não verificável → o limite aplica-se.
  if (total === null || total >= FREE_PLAN_LINK_LIMIT) return limitMessage;
  return null;
}

function extractSessionSecretFromSetCookie(value: string | null): string | null {
  if (!value || !APPWRITE_PROJECT_ID) return null;
  const match = value.match(new RegExp(`(?:^|,\\s*)a_session_${APPWRITE_PROJECT_ID}=([^;]+)`));
  return match?.[1] || null;
}

function targetUrl(path: string[], request: NextRequest): URL {
  const base = new URL(APPWRITE_ENDPOINT);
  const suffix = path.map((part) => encodeURIComponent(part)).join("/");
  const target = new URL(`${base.origin}${base.pathname.replace(/\/$/, "")}/${suffix}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  return target;
}

function isAllowedTarget(target: URL): boolean {
  const configured = new URL(APPWRITE_ENDPOINT);
  return target.origin === configured.origin && target.pathname.startsWith(`${configured.pathname.replace(/\/$/, "/")}`);
}

// ---- Filtro de campos (anti-mass-assignment) ------------------------------
// O allowlist por coleção vive em `@/lib/appwrite-fields` (fora do route
// handler) para ser testável: um allowlist desatualizado remove campos do body
// em silêncio e a escrita deixa de persistir sem erro. Ver
// src/__tests__/appwrite-fields.test.ts.

// O handler é privado: o typegen do Next.js 15.5 só aceita exports de métodos
// HTTP (GET/POST/...) em route handlers — um export extra `handler` faz o
// `next build` falhar com "Property 'handler' is incompatible with index
// signature".
async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return new NextResponse(null, { status: 405, headers: { Allow: [...ALLOWED_METHODS].join(", ") } });
  }
  if (!APPWRITE_PROJECT_ID) {
    return NextResponse.json({ message: "Appwrite not configured" }, { status: 503 });
  }

  // CSRF (double-submit): o client SDK injeta X-CSRF-Token em cada request
  // (ver src/lib/appwrite.ts). GET/HEAD/OPTIONS são ignorados pelo csrfGuard
  // — leituras (listDocuments, account.get, file views) continuam sem token.
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) {
    // csrfGuard devolve { error } (formato das app routes, cujos clients
    // lêem data.error). O client SDK expõe data.message — reescrevemos para
    // o formato nativo do Appwrite, senão o dashboard mostraria o JSON cru.
    return NextResponse.json(
      { message: "CSRF token inválido ou ausente. Recarregue a página e tente novamente." },
      { status: 403 }
    );
  }

  const sessionSecret = getAuthSessionSecret(request);
  const { path } = await context.params;
  const target = targetUrl(path, request);
  if (!isAllowedTarget(target)) {
    return NextResponse.json({ message: "Invalid Appwrite target" }, { status: 400 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json({ message: "Request too large" }, { status: 413 });
  }

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json({ message: "Request too large" }, { status: 413 });
  }

  // Parsing único do body JSON de documentos. O mesmo objeto serve a
  // validação de propriedade (abaixo) e a validação de tema (mais adiante).
  let jsonBody: Record<string, unknown> | null = null;
  if (body && isDocumentPath(path)) {
    try {
      jsonBody = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
    }
  }

  // Validação de propriedade — depois do CSRF e ANTES do rate limit (pedidos
  // rejeitados não gastam quota). Bloqueia a injeção de links/temas/
  // analíticas/páginas de terceiros via chamadas diretas ao proxy.
  const ownershipError = sessionSecret
    ? await validateDocumentOwnership(path, request.method, jsonBody, sessionSecret)
    : null;
  if (ownershipError) {
    return NextResponse.json({ message: ownershipError }, { status: 403 });
  }

  const rateLimitIdentifier = sessionSecret ? `user:${sessionSecret}` : `ip:${getClientIp(request)}`;
  let rateLimit;
  try {
    rateLimit = await checkRateLimit("api", rateLimitIdentifier, {
      maxRequests: 120,
      windowMs: 60 * 1000,
    });
  } catch {
    return NextResponse.json({ message: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Demasiados pedidos. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Excluímos também os headers `x-forwarded-*` (host/proto/for/port) que o
    // Next.js/middleware injetam: reencaminhá-los para o Appwrite quebra as
    // chamadas — ex: `x-forwarded-proto: http` em dev faz o Appwrite/Cloudflare
    // responder 301 (redirect http→https) a TODOS os pedidos do proxy, e o
    // `x-forwarded-host` local não deve chegar ao upstream. O proxy constrói
    // ele próprio o URL https absoluto do target.
    if (
      [
        "host",
        "content-length",
        "cookie",
        "x-fallback-cookies",
        "authorization",
        "x-appwrite-jwt",
        "x-appwrite-session",
        "x-appwrite-key",
        "x-csrf-token",
        // Header interno do proxy (idempotência) — não deve chegar ao Appwrite.
        "idempotency-key",
      ].includes(lower) ||
      lower.startsWith("x-forwarded-")
    ) {
      return;
    }
    headers.set(key, value);
  });
  headers.set("X-Appwrite-Project", APPWRITE_PROJECT_ID);

  if (isAccountPath(path) && !sessionSecret && !isOAuthNavigation(path) && !isPublicAccountPath(path)) {
    // Login, registration, password/session creation, JWT issuance and all
    // other account mutations must use the Redis-protected app routes.
    return NextResponse.json({ message: "Use the application authentication flow." }, { status: 403 });
  }
  if (sessionSecret) headers.set("X-Appwrite-Session", sessionSecret);

  const isThemeDocumentMutation =
    (request.method === "PUT" || request.method === "PATCH") &&
    path[0] === "databases" &&
    path[2] === "collections" &&
    path[3] === "themes" &&
    path[4] === "documents" &&
    path.length === 6;
  const isThemeDocumentCreate =
    request.method === "POST" &&
    path[0] === "databases" &&
    path[2] === "collections" &&
    path[3] === "themes" &&
    path[4] === "documents" &&
    path.length === 5;
  if ((isThemeDocumentMutation || isThemeDocumentCreate) && jsonBody) {
    const validationError = validateThemePayload(jsonBody.data);
    if (validationError) return NextResponse.json({ message: validationError }, { status: 400 });
  }

  // ---- Filtro de campos (anti-mass-assignment) ------------------------------
  // Aplica allowlist por coleção antes de encaminhar para o Appwrite.
  const collectionIdForFilter = isDocumentPath(path) ? path[3] : null;
  let bodyModified = false;
  if (jsonBody && collectionIdForFilter) {
    bodyModified = filterDocumentBody(jsonBody, collectionIdForFilter, request.method);
  }

  // Re-serializa o body se o filtro removeu campos proibidos.
  const bodyToSend: BodyInit | undefined = bodyModified
    ? JSON.stringify(jsonBody)
    : body
      ? new TextDecoder().decode(body)
      : undefined;

  // ---- Idempotência de criações -------------------------------------------
  //
  // Um duplo clique (ou um retry da mesma intenção) envia dois POSTs iguais;
  // cada `createDocument` no Appwrite gera um documento novo, logo criava
  // links duplicados. Com `Idempotency-Key` única por intenção, o 1º pedido
  // executa e os seguintes recebem o resultado guardado. A reserva da chave é
  // atómica (SET NX no Redis) — não há check-then-create não-atómico.
  //
  // Colocado depois da validação de propriedade/limite e do rate limit, para
  // que pedidos rejeitados não consumam chaves.
  const idempotencyKeyHeader = request.headers.get("idempotency-key");
  let claimedIdempotencyKey: string | null = null;
  if (
    request.method === "POST" &&
    isDocumentPath(path) &&
    sessionSecret &&
    isValidIdempotencyKey(idempotencyKeyHeader)
  ) {
    const claim = await claimIdempotencyKey(idempotencyScope(path, sessionSecret), idempotencyKeyHeader);
    if (claim.status === "replay") {
      // Mesma operação já executada → devolver exatamente o mesmo resultado.
      return new NextResponse(claim.response.body, {
        status: claim.response.status,
        headers: {
          "content-type": claim.response.contentType ?? "application/json",
          "cache-control": "no-store",
          "X-Idempotency-Replay": "true",
        },
      });
    }
    if (claim.status === "in-flight") {
      return NextResponse.json(
        { message: "Operação em processamento. Aguarde um instante e tente novamente." },
        { status: 409 },
      );
    }
    if (claim.status === "acquired") claimedIdempotencyKey = claim.storageKey;
  }

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: bodyToSend,
    redirect: "manual",
    cache: "no-store",
  });

  if (claimedIdempotencyKey) {
    if (upstream.ok) {
      // Guarda o resultado para que um replay devolva a MESMA resposta.
      const storedBody = await upstream.clone().text();
      await completeIdempotencyKey(claimedIdempotencyKey, {
        status: upstream.status,
        body: storedBody,
        contentType: upstream.headers.get("content-type"),
      });
    } else {
      // Nada foi criado → liberta a chave para permitir uma nova tentativa.
      await releaseIdempotencyKey(claimedIdempotencyKey);
    }
  }


  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (["set-cookie", "access-control-allow-origin", "access-control-allow-credentials", "content-length", "x-fallback-cookies"].includes(lower)) {
      return;
    }
    if (lower === "location") {
      responseHeaders.set("Location", value);
      return;
    }
    responseHeaders.set(key, value);
  });
  responseHeaders.set("Cache-Control", "no-store");

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: mergeRateLimitHeaders(responseHeaders, rateLimit),
  });

  // Appwrite Cloud may return the browser SDK fallback cookie during OAuth.
  // Validate it server-side and immediately convert it to our HttpOnly cookie.
  const fallbackSecret = extractLegacySessionSecret(upstream.headers.get("x-fallback-cookies"))
    ?? extractSessionSecretFromSetCookie(upstream.headers.get("set-cookie"));
  if (fallbackSecret) setAuthSessionCookie(response, fallbackSecret);
  return response;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
