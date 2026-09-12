import { ID, Query, Models, OAuthProvider, Permission, Role } from "appwrite";

import { account, databases, databaseId, Collections, Buckets, projectId, createOAuthAccount } from "./appwrite";
import { fetchWithCsrf } from "@/hooks/use-csrf";
import {
  ActivityAction,
  ActivityEntry,
  Appearance,
  LinkItem,
  PageProfile,
  PageType,
  PageTemplateId,
  UserAccount,
  AnalyticsData,
  TopDevice,
  SecurityLogEntry,
  SecurityLogInput,
  StaffApplication,
} from "./types";
import { defaultAppearance, emptyAnalytics } from "./defaults";
import { normalizeStaffApplicationMessage } from "./staff-security";
import { safeThemeColor, safeThemeFont, validateThemeField } from "./theme-validation";

type AppwriteDocument = Models.Document & Record<string, unknown>;

/**
 * Gera uma chave de idempotência única para uma INTENÇÃO de criação.
 *
 * A chave acompanha o pedido de criação (header `Idempotency-Key`) e permite
 * ao proxy /api/appwrite reconhecer pedidos duplicados/concorrentes da mesma
 * intenção — devolvendo o resultado da primeira execução em vez de criar
 * outro documento. Reutiliza-se a MESMA chave em retries da mesma intenção
 * (ex: resposta perdida na rede); uma nova intenção gera uma nova chave, por
 * isso dois links legitimamente semelhantes continuam a ser permitidos.
 */
export function createIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Ambientes sem randomUUID → fallback abaixo.
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---------- Auth helpers ----------

async function getCurrentSessionOrThrow(): Promise<Models.User<Models.Preferences>> {
  return getCurrentSession();
}

async function createOwnedDocument<T extends Record<string, unknown>>(
  collectionId: string,
  data: T,
  session?: Models.User<Models.Preferences>
) {
  // M7: reutiliza o session já obtido pelo caller (ex: requireOwnerOfPage)
  // para evitar um account.get() redundante por mutação.
  const current = session ?? (await getCurrentSessionOrThrow());
  return databases.createDocument(databaseId, collectionId, ID.unique(), data, [
    Permission.read(Role.user(current.$id)),
    Permission.update(Role.user(current.$id)),
    Permission.delete(Role.user(current.$id)),
  ]);
}

/**
 * Cria um documento enviando uma `Idempotency-Key` ao proxy.
 *
 * Feito com um fetch explícito (em vez do client SDK) porque a chave é
 * específica de cada intenção e o SDK não expõe headers por chamada. O corpo
 * é idêntico ao que o SDK envia (`{ documentId, data, permissions }`), por
 * isso as validações do proxy (propriedade + limite do plano free) continuam
 * a aplicar-se sem alterações.
 */
async function createOwnedDocumentIdempotent<T extends Record<string, unknown>>(
  collectionId: string,
  data: T,
  session: Models.User<Models.Preferences>,
  idempotencyKey: string,
): Promise<AppwriteDocument> {
  const response = await fetchWithCsrf(
    `/api/appwrite/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        documentId: ID.unique(),
        data,
        permissions: [
          Permission.read(Role.user(session.$id)),
          Permission.update(Role.user(session.$id)),
          Permission.delete(Role.user(session.$id)),
        ],
      }),
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | (AppwriteDocument & { message?: string })
    | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.message || "Não foi possível criar o link.");
  }
  return payload;
}

async function requireOwnerOfPage(idPagina: string): Promise<Models.User<Models.Preferences>> {
  const session = await getCurrentSessionOrThrow();
  try {
    const pageDoc = await databases.getDocument(databaseId, Collections.pages, idPagina);
    if (!pageDoc || String(pageDoc.idUtilizador) !== session.$id) {
      const error = new Error("Forbidden");
      (error as Error & { status?: number }).status = 403;
      throw error;
    }
  } catch (error) {
    // If Appwrite denied read access or the page does not exist, treat as 403
    // to avoid leaking whether the document exists.
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : undefined;
    if (status === 401 || status === 403 || status === 404) {
      const forbidden = new Error("Forbidden");
      (forbidden as Error & { status?: number }).status = 403;
      throw forbidden;
    }
    throw error;
  }
  return session;
}

// ---------- Auth ----------

/**
 * Recolhe o país/moeda do utilizador via GET /api/geo/lookup (server-side,
 * derivado do IP — nunca do body). Usado no registo e no sync OAuth para
 * apresentar os preços dos planos na moeda local do utilizador.
 */
export async function fetchUserGeo(): Promise<{
  country?: string;
  codigoPais?: string;
  currency?: string;
}> {
  try {
    const res = await fetch("/api/geo/lookup", { credentials: "include" });
    if (!res.ok) return {};
    return (await res.json()) as { country?: string; codigoPais?: string; currency?: string };
  } catch {
    return {};
  }
}

export async function registerUser(email: string, password: string, name: string, consent: boolean) {
  // O registo cria uma sessão nova — nunca reutilizar a cache anterior.
  invalidateSessionCache();
  const response = await fetchWithCsrf("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, consent }),
  });
  const data = await response.json().catch(() => ({})) as {
    user?: Models.User<Models.Preferences>;
    verificationSent?: boolean;
    error?: string;
  };
  if (!response.ok || !data.user) {
    throw new Error(data.error || "Não foi possível criar a conta.");
  }

  // O consentimento é reenviado para o provision, que grava a data/hora
  // (definida pelo servidor) no perfil — prova auditável do aceite.
  const provision = await fetchWithCsrf("/api/users/provision", {
    method: "POST",
    body: JSON.stringify({ consent }),
  });
  if (!provision.ok) {
    // Do not leave a newly-created account authenticated if the mandatory
    // profile transaction cannot be completed.
    await fetchWithCsrf("/api/auth/logout", { method: "POST" }).catch(() => {});
    throw new Error("Não foi possível preparar o perfil da conta.");
  }
  const provisionData = await provision.json() as { profile?: UserAccount };
  const geo = provisionData.profile
    ? {
        pais: provisionData.profile.pais,
        codigoPais: provisionData.profile.codigoPais,
        moeda: provisionData.profile.moeda,
      }
    : {};
  return {
    account: data.user,
    geo,
    // O servidor indica se o email de verificação foi pedido ao Appwrite
    // (best-effort) — usado para avisar o utilizador na página de confirmação.
    verificationSent: data.verificationSent === true,
  };
}

/**
 * Reenvia o email de verificação de email (Appwrite) para o utilizador
 * autenticado — POST /api/auth/verify (CSRF + rate limit no servidor).
 */
export async function sendEmailVerification(): Promise<{ sent: boolean }> {
  const response = await fetchWithCsrf("/api/auth/verify", { method: "POST" });
  if (!response.ok) {
    throw new Error("Não foi possível enviar o email de verificação.");
  }
  return { sent: true };
}

/**
 * Estado de verificação de email do utilizador autenticado — lido do Appwrite
 * via /api/auth/me (o servidor devolve emailVerification; nunca é confiável
 * no cliente). Lança erro se não estiver autenticado.
 */
export async function getEmailVerificationStatus(): Promise<{ verified: boolean }> {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    // Distingue "sem sessão" (401) de falhas de rede/transientes, para a UI
    // mostrar a mensagem certa em cada caso.
    const error = new Error("Unauthorized") as Error & { isUnauthorized?: boolean };
    error.isUnauthorized = true;
    throw error;
  }
  const data = (await response.json().catch(() => ({}))) as {
    user?: { emailVerification?: boolean };
  };
  return { verified: data.user?.emailVerification === true };
}

export async function requestPasswordReset(email: string): Promise<{ sent: boolean }> {
  const response = await fetchWithCsrf("/api/auth/password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  const data = await response.json().catch(() => ({})) as { sent?: boolean; error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível solicitar a recuperação.");
  return { sent: data.sent === true };
}

export async function completeEmailVerification(idUtilizador: string, secret: string) {
  return account.updateEmailVerification(idUtilizador, secret);
}

export async function completePasswordReset(idUtilizador: string, secret: string, password: string) {
  return account.updateRecovery(idUtilizador, secret, password);
}

export async function loginUser(email: string, password: string, remember = true) {
  const response = await fetchWithCsrf("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, remember }),
  });
  const data = await response.json().catch(() => ({})) as {
    user?: Models.User<Models.Preferences>;
    error?: string;
  };
  if (!response.ok || !data.user) {
    throw new Error(data.error || "Email ou palavra-passe incorretos.");
  }
  // Sessão nova → a cache não pode devolver o utilizador anterior.
  invalidateSessionCache();
  return data.user;
}

export async function logoutUser() {
  const response = await fetchWithCsrf("/api/auth/logout", { method: "POST" });
  if (!response.ok) {
    throw new Error("Não foi possível terminar a sessão.");
  }
  invalidateSessionCache();
}

async function migrateLegacyBrowserSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const fallback = window.localStorage.getItem("cookieFallback");
  if (!fallback) return;

  const response = await fetchWithCsrf("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({ fallback }),
  });
  // A successful migration or a malformed/expired legacy session must not
  // leave an Appwrite secret in localStorage indefinitely.
  if (response.ok || response.status === 401) {
    window.localStorage.removeItem("cookieFallback");
  }
}

/**
 * Cache de sessão (TTL curto) + deduplicação de chamadas concorrentes.
 *
 * Sem isto, cada operação do dashboard repetia `GET /api/auth/me` — e esse
 * endpoint é um round trip proxied até ao Appwrite (`account.get`). Uma
 * única ação (criar/editar link, guardar tema) chamava-o 2–3 vezes
 * (mutação + `logActivity` + refresh), somando centenas de ms ao clique.
 *
 * O TTL é curto (5s) de propósito: uma sessão válida é estável nesse
 * intervalo, e a cache é invalidada explicitamente em login/logout/registo
 * (ver `invalidateSessionCache`). Uma sessão expirada continua a falhar
 * normalmente no fim do TTL.
 */
const SESSION_CACHE_TTL_MS = 5_000;
let cachedSession: { user: Models.User<Models.Preferences>; expiresAt: number } | null = null;
let sessionRequest: Promise<Models.User<Models.Preferences>> | null = null;

/** Invalida a cache de sessão — chamar após login, registo, logout e eliminação de conta. */
export function invalidateSessionCache(): void {
  cachedSession = null;
  sessionRequest = null;
}

async function fetchCurrentSession(): Promise<Models.User<Models.Preferences>> {
  await migrateLegacyBrowserSession().catch(() => {});
  let response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });

  // OAuth is the only legacy browser flow. After the provider redirects back,
  // one direct read lets Appwrite expose its fallback session locally; it is
  // immediately exchanged for the HttpOnly application cookie below. Email
  // and password are never sent through this client path.
  if (!response.ok && typeof window !== "undefined") {
    try {
      await createOAuthAccount().get();
      await migrateLegacyBrowserSession();
      response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    } catch {
      // Fall through to the normal unauthorized result.
    }
  }

  if (!response.ok) {
    throw new Error("Unauthorized");
  }
  const data = await response.json() as { user?: Models.User<Models.Preferences> };
  if (!data.user) throw new Error("Unauthorized");
  return data.user;
}

export async function getCurrentSession() {
  const now = Date.now();
  if (cachedSession && cachedSession.expiresAt > now) {
    return cachedSession.user;
  }
  // Chamadas concorrentes partilham o mesmo pedido em vez de dispararem
  // vários `/api/auth/me` em paralelo (ex: init do AuthContext + logActivity).
  if (sessionRequest) return sessionRequest;

  sessionRequest = fetchCurrentSession()
    .then((user) => {
      cachedSession = { user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS };
      return user;
    })
    .finally(() => {
      sessionRequest = null;
    });

  return sessionRequest;
}

/**
 * Helper partilhado para iniciar OAuth2.
 *
 * - Devolve cedo com `?error=missing_project` quando o projectId não chegou
 *   ao cliente (em vez de chamar Appwrite que falharia silenciosamente).
 * - Não sobrepõe a failure URL com `?error=oauth_failed` para deixar o
 *   Appwrite anexar `error` + `error_description` reais à query string.
 *   Assim a página de login consegue mostrar a mensagem do Appwrite.
 */
function createOAuthSession(provider: OAuthProvider, consent = false) {
  if (!projectId) {
    window.location.assign(`${window.location.origin}/login?error=missing_project`);
    return;
  }
  const providerKey = provider === OAuthProvider.Google ? "google" : "github";
  // The server route applies the distributed limit and owns the callback
  // allowlist. It then redirects to Appwrite's provider endpoint.
  // `consent=1` (só no registo) marca o cookie que faz /oauth/sync gravar a
  // prova de consentimento no perfil do novo utilizador.
  window.location.assign(`/api/auth/oauth/start?provider=${providerKey}${consent ? "&consent=1" : ""}`);
}

export function loginWithGoogle(consent = false) {
  createOAuthSession(OAuthProvider.Google, consent);
}

export function loginWithGitHub(consent = false) {
  createOAuthSession(OAuthProvider.Github, consent);
}

async function fetchWithAppwriteAuth(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithCsrf(url, options);
}

export async function checkAndSyncOAuthUser(user: Models.User<Models.Preferences>): Promise<boolean> {
  try {
    // M3: usa fetchWithCsrf (com header X-CSRF-Token) — o endpoint agora
    // valida CSRF. Usa o server SDK via API route para criar/verificar o
    // documento, evitando problemas de permissão do client SDK.
    const res = await fetchWithAppwriteAuth("/api/auth/oauth/sync", {
      method: "POST",
      body: JSON.stringify({
        idUtilizador: user.$id,
        email: user.email,
        nomeExibicao: user.name || "Utilizador",
        createdAt: user.$createdAt || new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("[checkAndSyncOAuthUser] API error:", data.error || res.status);
      return res.status !== 403;
    }
    return true;
  } catch (error) {
    // Não deve impedir o login OAuth — falha silenciosa.
    if (process.env.NODE_ENV === "development") {
      console.warn("[checkAndSyncOAuthUser] Failed to sync:", error);
    }
    return true;
  }
}

export async function getUserProfile(idUtilizador: string): Promise<UserAccount | null> {
  const docs = await databases.listDocuments(databaseId, Collections.users, [
    Query.equal("idUtilizador", idUtilizador),
  ]);
  if (docs.documents.length === 0) return null;
  const doc = docs.documents[0] as AppwriteDocument;
  return {
    email: String(doc.email),
    nomeExibicao: String(doc.nomeExibicao),
    criadoEm: String(doc.criadoEm),
    plano: ["free", "pro", "business", "enterprise"].includes(String(doc.plano))
      ? (String(doc.plano) as UserAccount["plano"])
      : "free",
    pais: doc.pais ? String(doc.pais) : undefined,
    codigoPais: doc.codigoPais ? String(doc.codigoPais) : undefined,
    moeda: doc.moeda ? String(doc.moeda) : undefined,
  };
}

// ---------- Pages ----------

/** True se o erro do Appwrite for um conflito de documento já existente (409). */
function isAlreadyExistsError(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null &&
    "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : undefined;
  const message = error instanceof Error ? error.message : "";
  return status === 409 || message.includes("already exists");
}

/**
 * Traduz o 409 do Appwrite (índice único no nomeUtilizador — "Document with the
 * requested ID ... already exists") para uma mensagem amigável. Lança sempre.
 */
function throwPageConflict(error: unknown): never {
  if (isAlreadyExistsError(error)) {
    const friendly = new Error("Este nome de utilizador já está em uso. Escolha outro.");
    (friendly as Error & { status?: number }).status = 409;
    throw friendly;
  }
  throw error;
}

/** Métricas iniciais do documento `analytics` (agregados reais a zeros). */
function initialMetricsJson(): string {
  return JSON.stringify({
    ctr: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
    visitorGrowth: 0,
    topLinks: [],
    topCountries: [],
    topDevices: [],
    deviceLog: [],
    recentVisitors: [],
    hourlyStats: [],
    dailyStats: [],
    visitorSet: [],
    dailyVisitors: [],
    uniqueVisitors: 0,
  });
}

/**
 * Garante que a página tem os documentos laterais obrigatórios (`themes` e
 * `analytics`).
 *
 * Porque existe: os documentos laterais só eram criados no caminho "página
 * nova". O caminho idempotente (o utilizador já tem página — dupla submissão,
 * retry, ou uma tentativa anterior que ficou a meio) fazia `return` cedo e
 * deixava a página SEM tema. Consequência real, verificada em produção: 7 de 9
 * páginas não tinham documento de `themes`, e como `getThemeByPageId` devolve
 * `$id: ""` e o `updateAppearance` do AuthContext só escreve `if (themeId)`,
 * TODAS as alterações de aparência dessas páginas eram descartadas em
 * silêncio — o toggle mexia na UI e voltava ao original ao recarregar.
 *
 * Idempotente: lê primeiro e só cria o que falta. Um 409 (índice único em
 * `idPagina`, corrida com outro pedido) conta como sucesso.
 */
async function ensurePageSidecars(
  idPagina: string,
  session: Models.User<Models.Preferences>,
): Promise<void> {
  const [themes, analytics] = await Promise.all([
    databases.listDocuments(databaseId, Collections.themes, [
      Query.equal("idPagina", idPagina),
      Query.limit(1),
    ]),
    databases.listDocuments(databaseId, Collections.analytics, [
      Query.equal("idPagina", idPagina),
      Query.limit(1),
    ]),
  ]);

  const pending: Promise<unknown>[] = [];

  if (themes.documents.length === 0) {
    // NOTA: o schema Appwrite chama-se `tema` (ver provision-appwrite.ts) —
    // enviar `theme` falha com "Unknown attribute". O campo é legado (o sistema
    // atual usa apenas Liquid Glass), enviado por defesa em profundidade.
    pending.push(
      createOwnedDocument(
        Collections.themes,
        { idPagina, tema: "glass", ...defaultAppearance() },
        session,
      ).catch((error) => {
        if (!isAlreadyExistsError(error)) throw error;
      }),
    );
  }

  if (analytics.documents.length === 0) {
    pending.push(
      createOwnedDocument(
        Collections.analytics,
        {
          idPagina,
          visualizacoes: 0,
          cliques: 0,
          seguidores: 0,
          metricasJson: initialMetricsJson(),
        },
        session,
      ).catch((error) => {
        if (!isAlreadyExistsError(error)) throw error;
      }),
    );
  }

  await Promise.all(pending);
}

/**
 * Devolve o tema da página, criando-o se não existir (auto-cura).
 *
 * Sem isto, uma página sem documento de `themes` fica permanentemente sem
 * aparência persistente: `getThemeByPageId` devolve `$id: ""` e o
 * `updateAppearance` do AuthContext verifica `if (themeId)` antes de escrever,
 * por isso nenhuma alteração chega à base de dados. As páginas já existentes
 * são corrigidas no primeiro carregamento do dashboard.
 */
export async function ensureThemeForPage(idPagina: string): Promise<Appearance & { $id: string }> {
  const existing = await getThemeByPageId(idPagina);
  if (existing.$id) return existing;

  try {
    const session = await requireOwnerOfPage(idPagina);
    await createOwnedDocument(
      Collections.themes,
      { idPagina, tema: "glass", ...defaultAppearance() },
      session,
    );
  } catch (error) {
    // 409 = outro pedido criou-o entretanto (índice único em idPagina) → re-lê.
    if (!isAlreadyExistsError(error)) {
      // Nunca bloquear o dashboard: mantém o comportamento anterior (defaults
      // sem documento) e deixa o erro registado.
      console.warn("[ensureThemeForPage] não foi possível criar o tema da página:", error);
      return { ...defaultAppearance(), $id: "" };
    }
  }

  return getThemeByPageId(idPagina);
}

export async function createPage(profile: Omit<PageProfile, "publicado">) {
  const session = await getCurrentSession();

  // Idempotente: se o utilizador JÁ tem uma página (ex: dupla submissão do
  // botão ou tentativa anterior que ficou a meio), atualiza-a em vez de
  // criar outra — o índice único no nomeUtilizador rejeitaria a segunda com
  // "Document with the requested ID ... already exists" (409).
  const existing = await getPageByUserId(session.$id).catch(() => null);
  if (existing) {
    try {
      // updatePage já regista a atividade (page_updated) e faz o owner check.
      const updated = await updatePage(existing.$id, {
        nomeUtilizador: profile.nomeUtilizador,
        nomeExibicao: profile.nomeExibicao,
        biografia: profile.biografia ?? "",
        tipoPagina: profile.tipoPagina ?? existing.tipoPagina ?? "minimal",
        modeloPagina: profile.modeloPagina ?? existing.modeloPagina ?? "template1",
      });
      // Este caminho fazia `return` sem criar os documentos laterais, deixando
      // a página sem tema (aparência nunca persistia). Ver ensurePageSidecars.
      await ensurePageSidecars(existing.$id, session);
      return updated;
    } catch (error) {
      // Username alterado para um já usado por OUTRO utilizador → 409 cru.
      throwPageConflict(error);
    }
  }

  let doc: AppwriteDocument;
  try {
    doc = await databases.createDocument(databaseId, Collections.pages, ID.unique(), {
      ...profile,
      idUtilizador: session.$id,
      publicado: false,
      tipoPagina: profile.tipoPagina ?? "minimal",
      modeloPagina: profile.modeloPagina ?? "template1",
    }, [
      Permission.read(Role.user(session.$id)),
      Permission.update(Role.user(session.$id)),
      Permission.delete(Role.user(session.$id)),
    ]);
  } catch (error) {
    // Só o createDocument da página traduz o 409 para "nomeUtilizador em uso" — os
    // 409 dos passos seguintes (theme/analytics) são outra coisa (ver abaixo).
    throwPageConflict(error);
  }
  // Registo de atividade: página criada. Fire-and-forget — não bloqueia o
  // redirect do dashboard nem o carregamento.
  void logActivity("page_created", { nomeUtilizador: profile.nomeUtilizador, nomeExibicao: profile.nomeExibicao });

  // Cria o tema e o analytics vazios (idempotente — ver ensurePageSidecars).
  await ensurePageSidecars(doc.$id, session);

  return doc;
}

export async function getPageByUsername(nomeUtilizador: string): Promise<(PageProfile & { $id: string }) | null> {
  const docs =    await databases.listDocuments(databaseId, Collections.pages, [
    Query.equal("nomeUtilizador", nomeUtilizador.toLowerCase()),
    Query.equal("publicado", true),
  ]);
  if (docs.documents.length === 0) return null;
  const doc = docs.documents[0] as AppwriteDocument;
  return mapPageDocument(doc);
}

export async function getPageByUserId(idUtilizador: string): Promise<(PageProfile & { $id: string }) | null> {
  const docs = await databases.listDocuments(databaseId, Collections.pages, [
    Query.equal("idUtilizador", idUtilizador),
  ]);
  if (docs.documents.length === 0) return null;
  const doc = docs.documents[0] as AppwriteDocument;
  return mapPageDocument(doc);
}

export async function updatePage(idPagina: string, patch: Partial<PageProfile>) {
  await requireOwnerOfPage(idPagina);
  const doc = await databases.updateDocument(databaseId, Collections.pages, idPagina, patch);
  // Registo de atividade: página atualizada (inclui publicar/despublicar)
  if (typeof patch.publicado === "boolean") {
    void logActivity(
      patch.publicado ? "page_published" : "page_unpublished",
      { nomeUtilizador: String(doc.nomeUtilizador ?? "") }
    );
  } else {
    void logActivity("page_updated", { nomeUtilizador: String(doc.nomeUtilizador ?? "") });
  }
  return doc;
}

function mapPageDocument(doc: AppwriteDocument): PageProfile & { $id: string } {
  return {
    $id: doc.$id,
    nomeUtilizador: String(doc.nomeUtilizador),
    nomeExibicao: String(doc.nomeExibicao),
    biografia: String(doc.biografia ?? ""),
    avatar: doc.idAvatar ? getFilePreviewUrl(Buckets.files, String(doc.idAvatar)) : undefined,
    banner: doc.idBanner ? getFilePreviewUrl(Buckets.files, String(doc.idBanner)) : undefined,
    publicado: Boolean(doc.publicado),
    tipoPagina: (doc.tipoPagina as PageType) ?? "minimal",
    modeloPagina: (doc.modeloPagina as PageTemplateId) ?? "template1",
    emblemas: Array.isArray(doc.emblemas)
      ? (doc.emblemas as string[]).filter((badge) => badge !== "staff")
      : [],
    publicacaoAgendadaEm: doc.publicacaoAgendadaEm ? String(doc.publicacaoAgendadaEm) : undefined,
    despublicacaoAgendadaEm: doc.despublicacaoAgendadaEm ? String(doc.despublicacaoAgendadaEm) : undefined,
  };
}

// ---------- Links ----------

export async function getLinksByPageId(idPagina: string): Promise<LinkItem[]> {
  if (!idPagina) return [];
  const docs = await databases.listDocuments(databaseId, Collections.links, [
    Query.equal("idPagina", idPagina),
    Query.orderAsc("ordem"),
  ]);
  return docs.documents.map((doc) => mapLinkDocument(doc as AppwriteDocument));
}

function mapLinkDocument(doc: AppwriteDocument): LinkItem {
  return {
    id: doc.$id,
    tipo: doc.tipo as LinkItem["tipo"],
    titulo: String(doc.titulo),
    descricao: doc.descricao ? String(doc.descricao) : undefined,
    url: String(doc.url),
    icone: doc.icone ? String(doc.icone) : undefined,
    cor: doc.cor ? String(doc.cor) : undefined,
    image: doc.idImagem ? getFilePreviewUrl(Buckets.files, String(doc.idImagem)) : undefined,
    animacao: (doc.animacao as LinkItem["animacao"]) ?? "none",
    ativo: Boolean(doc.ativo),
    visivel: Boolean(doc.visivel),
    novaAba: Boolean(doc.novaAba),
    ordem: Number(doc.ordem),
    cliques: Number(doc.cliques),
    agendadoPara: doc.agendadoPara ? String(doc.agendadoPara) : undefined,
  };
}

export async function createLink(
  idPagina: string,
  link: Omit<LinkItem, "id">,
  idempotencyKey?: string,
) {
  // O limite de links do plano gratuito é imposto server-side no proxy
  // /api/appwrite — o único ponto de entrada das escritas do browser (ver
  // enforceFreeLinkLimit no proxy). O client não duplica a verificação.
  const session = await requireOwnerOfPage(idPagina);

  const data = {
    idPagina,
    tipo: link.tipo,
    titulo: link.titulo,
    url: link.url,
    descricao: link.descricao,
    icone: link.icone,
    cor: link.cor,
    idImagem: link.image,
    animacao: link.animacao,
    ativo: link.ativo,
    visivel: link.visivel,
    novaAba: link.novaAba,
    ordem: link.ordem,
    cliques: link.cliques,
    agendadoPara: link.agendadoPara,
  };

  // Com chave de idempotência, pedidos duplicados/concorrentes da mesma
  // intenção devolvem o mesmo documento (nunca criam dois links).
  const created = idempotencyKey
    ? await createOwnedDocumentIdempotent(Collections.links, data, session, idempotencyKey)
    : await createOwnedDocument(Collections.links, data, session);
  // Registo de atividade: link criado
  void logActivity("link_created", { titulo: link.titulo });
  return created;
}

export async function updateLink(linkId: string, patch: Partial<Omit<LinkItem, "id">>) {
  const linkDoc = await databases.getDocument(databaseId, Collections.links, linkId);
  await requireOwnerOfPage(String(linkDoc.idPagina));
  const appwritePatch: Record<string, unknown> = { ...patch };
  if ("image" in appwritePatch) {
    appwritePatch.idImagem = appwritePatch.image;
    delete appwritePatch.image;
  }
  const doc = await databases.updateDocument(databaseId, Collections.links, linkId, appwritePatch);
  // Registo de atividade: link atualizado — mas NÃO quando é apenas a ordem
  // (o drag-reorder dispara um updateLink por link e inundaria o feed).
  const meaningfulKeys = Object.keys(appwritePatch).filter((k) => k !== "ordem");
  if (meaningfulKeys.length > 0) {
    void logActivity("link_updated", { titulo: String(doc.titulo ?? "") });
  }
  return doc;
}

export async function deleteLink(linkId: string) {
  const linkDoc = await databases.getDocument(databaseId, Collections.links, linkId);
  await requireOwnerOfPage(String(linkDoc.idPagina));
  await databases.deleteDocument(databaseId, Collections.links, linkId);
  // Registo de atividade: link eliminado
  void logActivity("link_deleted", { titulo: String(linkDoc.titulo ?? "") });
}

// ---------- Themes ----------

export async function getThemeByPageId(idPagina: string): Promise<Appearance & { $id: string }> {
  const docs = await databases.listDocuments(databaseId, Collections.themes, [
    Query.equal("idPagina", idPagina),
  ]);
  if (docs.documents.length === 0) {
    return { ...defaultAppearance(), $id: "" };
  }
  const doc = docs.documents[0] as AppwriteDocument;
  return {
    $id: doc.$id,
    desfoco: Number(doc.desfoco),
    arredondado: Number(doc.arredondado),
    opacidadeLinks: Number(doc.opacidadeLinks),
    corFundo: safeThemeColor(doc.corFundo, "#0a0a0a"),
    corCartao: safeThemeColor(doc.corCartao, "rgba(255,255,255,0.03)"),
    corTexto: safeThemeColor(doc.corTexto, "#fafafa"),
    corDestaque: safeThemeColor(doc.corDestaque, "#fafafa"),
    familiaFonte: safeThemeFont(doc.familiaFonte),
    tamanhoFonte: Number(doc.tamanhoFonte),
    raioBotao: Number(doc.raioBotao),
    larguraBotao: String(doc.larguraBotao) as Appearance["larguraBotao"],
    alturaBotao: String(doc.alturaBotao) as Appearance["alturaBotao"],
    estiloBotao: String(doc.estiloBotao) as Appearance["estiloBotao"],
    sombra: String(doc.sombra) as Appearance["sombra"],
    mostrarAvatar: Boolean(doc.mostrarAvatar),
    mostrarBiografia: Boolean(doc.mostrarBiografia),
    mostrarSocial: doc.mostrarSocial !== undefined ? Boolean(doc.mostrarSocial) : true,
    espacamento: Number(doc.espacamento),
    opacidadeVidro: doc.opacidadeVidro !== undefined ? Number(doc.opacidadeVidro) : 35,
    desfocoVidro: doc.desfocoVidro !== undefined ? Number(doc.desfocoVidro) : 25,
    intensidadeVidro: doc.intensidadeVidro !== undefined ? Number(doc.intensidadeVidro) : 50,
  };
}

/** Campos que existem no schema Appwrite da coleção themes */
const THEME_SAFE_FIELDS = [
  "desfoco", "arredondado", "opacidadeLinks",
  "corFundo", "corCartao", "corTexto", "corDestaque",
  "familiaFonte", "tamanhoFonte", "raioBotao", "larguraBotao", "alturaBotao", "estiloBotao", "sombra",
  "mostrarAvatar", "mostrarBiografia", "mostrarSocial", "espacamento",
  "opacidadeVidro", "desfocoVidro", "intensidadeVidro",
] as const;

export async function updateTheme(themeId: string, appearance: Appearance) {
  const themeDoc = await databases.getDocument(databaseId, Collections.themes, themeId);
  await requireOwnerOfPage(String(themeDoc.idPagina));

  // Apenas envia os campos que existem no schema Appwrite.
  const safePayload: Record<string, unknown> = {};
  for (const field of THEME_SAFE_FIELDS) {
    if (field in appearance) {
      const value = (appearance as unknown as Record<string, unknown>)[field];
      if (!validateThemeField(field, value)) {
        throw new Error(`Valor de tema inválido: ${field}.`);
      }
      safePayload[field] = value;
    }
  }

  const doc = await databases.updateDocument(databaseId, Collections.themes, themeId, safePayload);
  // Registo de atividade: aparência atualizada (throttled para sliders)
  void logActivity("appearance_updated");
  return doc;
}

// ---------- Security Logs ----------

export async function createSecurityLog(input: SecurityLogInput) {
  // Security logs must be created server-side so the idUtilizador is derived from the session.
  // Pre-login (anonymous) events are sent to a dedicated endpoint that does not
  // accept a client-provided idUtilizador and is rate-limited by IP.
  const isAnonymous = input.idUtilizador === "anonymous";
  const endpoint = isAnonymous ? "/api/security/log-anonymous" : "/api/security/log";
  try {
    await fetchWithCsrf(endpoint, {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (error) {
    // Silently fail — logging should never break auth
    if (process.env.NODE_ENV === "development") {
      console.warn("[SecurityLog] Failed to create log:", error);
    }
  }
}

export async function getRecentSecurityLogs(_userId: string, limit = 50): Promise<SecurityLogEntry[]> {
  // Security logs are now fetched through a server-side API that enforces ownership.
  try {
    const res = await fetch(`/api/security/logs?limit=${limit}`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as { logs?: SecurityLogEntry[] };
    return data.logs ?? [];
  } catch {
    return [];
  }
}

// ---------- Analytics ----------

export async function getAnalyticsByPageId(idPagina: string): Promise<AnalyticsData> {
  const docs = await databases.listDocuments(databaseId, Collections.analytics, [
    Query.equal("idPagina", idPagina),
  ]);
  const doc = docs.documents[0] as AppwriteDocument | undefined;
  if (!doc) {
    return emptyAnalytics();
  }
  const metrics: Partial<AnalyticsData> & { deviceLog?: string[]; visitorSet?: string[] } = JSON.parse(String(doc.metricasJson ?? "{}"));

  // topDevices: agregado real (contagens por tipo). Fallback: deviceLog legado.
  let topDevices: TopDevice[];
  const storedDevices = Array.isArray(metrics.topDevices) ? metrics.topDevices : [];
  if (storedDevices.length > 0) {
    const total = storedDevices.reduce((sum, d) => sum + (d.count || 0), 0);
    topDevices = storedDevices.map((d) => ({
      tipo: d.tipo,
      count: d.count || 0,
      percentage: total > 0 ? Math.round(((d.count || 0) / total) * 100) : 0,
    }));
  } else {
    const deviceLog = Array.isArray(metrics.deviceLog) ? metrics.deviceLog : [];
    if (deviceLog.length > 0) {
      const counts: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
      for (const d of deviceLog) {
        if (d in counts) counts[d] += 1;
      }
      const total = deviceLog.length;
      topDevices = ["mobile", "desktop", "tablet"].map((tipo) => ({
        tipo: tipo as TopDevice["tipo"],
        count: counts[tipo],
        percentage: Math.round((counts[tipo] / total) * 100),
      }));
    } else {
      topDevices = [];
    }
  }

  const uniqueVisitors = Number(metrics.uniqueVisitors ?? 0);

  return {
    visualizacoes: Number(doc.visualizacoes),
    cliques: Number(doc.cliques),
    ctr: Number(metrics.ctr ?? 0),
    seguidores: Number(doc.seguidores),
    uniqueVisitors,
    visitorGrowth: Number(metrics.visitorGrowth ?? 0),
    weeklyGrowth: Number(metrics.weeklyGrowth ?? 0),
    monthlyGrowth: Number(metrics.monthlyGrowth ?? 0),
    topLinks: (Array.isArray(metrics.topLinks) ? metrics.topLinks : []).sort((a, b) => b.cliques - a.cliques),
    topCountries: (Array.isArray(metrics.topCountries) ? metrics.topCountries : []).sort((a, b) => b.count - a.count),
    topDevices,
    recentVisitors: Array.isArray(metrics.recentVisitors) ? metrics.recentVisitors : [],
    hourlyStats: Array.isArray(metrics.hourlyStats) ? metrics.hourlyStats : [],
    dailyStats: Array.isArray(metrics.dailyStats) ? metrics.dailyStats : [],
  };
}

// ---------- Activity Logs (Atividades recentes) ----------

/** IP real do utilizador, obtido uma vez do servidor (/api/activity/ip). */
let cachedClientIp: string | null = null;

async function getClientIpForActivity(): Promise<string | undefined> {
  if (cachedClientIp) return cachedClientIp;
  try {
    const res = await fetch("/api/activity/ip", { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as { ip?: string };
      cachedClientIp = data.ip || null;
    }
  } catch {
    // Sem IP — a atividade é registada na mesma (o IP é opcional).
  }
  return cachedClientIp ?? undefined;
}

/**
 * Ações de alta frequência (sliders da aparência) — throttled para não
 * inundar o cartão. Ações discretas (criar/apagar links, publicar, etc.)
 * são SEMPRE registadas: o utilizador pediu que TODA a atividade apareça.
 */
const HIGH_FREQUENCY_ACTIONS = new Set<string>(["appearance_updated"]);
const lastLoggedAt = new Map<string, number>();
function shouldLogAction(action: string): boolean {
  if (!HIGH_FREQUENCY_ACTIONS.has(action)) return true;
  const now = Date.now();
  const last = lastLoggedAt.get(action) ?? 0;
  if (now - last < 3000) return false;
  lastLoggedAt.set(action, now);
  return true;
}

/**
 * Regista uma atividade da conta no cartão "Atividades recentes".
 *
 * - Escrito pelo client SDK autenticado (sessão no localStorage) com
 *   permissões por documento (Role.user) — só o dono lê o seu registo.
 * - O IP vem do servidor (x-forwarded-for), nunca do body.
 * - Nunca quebra a ação principal (erros são silenciosos).
 */
export async function logActivity(
  action: ActivityAction,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    if (!shouldLogAction(action)) return;
    const session = await getCurrentSessionOrThrow();
    const ip = await getClientIpForActivity();
    await databases.createDocument(databaseId, Collections.activityLogs, ID.unique(), {
      idUtilizador: session.$id,
      acao: action,
      detalhes: details ? JSON.stringify(details).slice(0, 2000) : "",
      enderecoIP: ip ?? "",
      agenteUtilizador: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
      criadoEm: new Date().toISOString(),
    }, [
      Permission.read(Role.user(session.$id)),
      Permission.update(Role.user(session.$id)),
      Permission.delete(Role.user(session.$id)),
    ]);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Activity] Failed to log:", error);
    }
  }
}

/** Últimas atividades da conta (mais recentes primeiro). */
export async function getRecentActivities(limit = 15): Promise<ActivityEntry[]> {
  try {
    const session = await getCurrentSession();
    const docs = await databases.listDocuments(databaseId, Collections.activityLogs, [
      Query.equal("idUtilizador", session.$id),
      Query.orderDesc("criadoEm"),
      Query.limit(Math.min(Math.max(limit, 1), 50)),
    ]);
    return docs.documents.map((doc) => ({
      $id: doc.$id,
      idUtilizador: String(doc.idUtilizador ?? ""),
      acao: doc.acao as ActivityAction,
      detalhes: doc.detalhes ? String(doc.detalhes) : undefined,
      enderecoIP: doc.enderecoIP ? String(doc.enderecoIP) : undefined,
      agenteUtilizador: doc.agenteUtilizador ? String(doc.agenteUtilizador) : undefined,
      criadoEm: String(doc.criadoEm ?? ""),
    }));
  } catch {
    return [];
  }
}

// ---------- Badges ----------

/**
 * Concede uma badge à página do utilizador autenticado.
 *
 * A escrita acontece no servidor (`POST /api/badges`). O documento `pages` é
 * editável pelo utilizador, por isso o proxy `/api/appwrite` remove `emblemas`
 * do allowlist — escrevê-lo aqui (client SDK) era silenciosamente descartado e
 * a badge nunca persistia. As regras de desbloqueio (equipa, plano,
 * candidatura ao staff) são agora aplicadas no servidor, onde o plano vem do
 * registo `users` e a aprovação vem de `staff_applications`.
 *
 * Devolve `true` quando a badge foi persistida agora. Para badges derivadas
 * (ex: `staff`, cuja origem é a candidatura aprovada) devolve sempre `false`:
 * não há nada a escrever em `pages`.
 */
export async function grantBadge(badgeId: string): Promise<boolean> {
  const response = await fetchWithCsrf("/api/badges", {
    method: "POST",
    body: JSON.stringify({ badgeId, action: "grant" }),
  });
  const data = await response.json().catch(() => ({})) as { granted?: boolean; error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Não foi possível conceder a badge.");
  }
  if (data.granted === true) {
    void logActivity("badge_earned", { badge: badgeId });
  }
  return data.granted === true;
}

/**
 * Remove uma badge da página (usado para sincronizar a badge pro com o plano).
 * Passa pela mesma rota server-side, pelas razões descritas em `grantBadge`.
 */
export async function revokeBadge(badgeId: string): Promise<void> {
  const response = await fetchWithCsrf("/api/badges", {
    method: "POST",
    body: JSON.stringify({ badgeId, action: "revoke" }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || "Não foi possível remover a badge.");
  }
}

/**
 * Cria uma candidatura ao staff (coleção staff_applications).
 * - Só permite uma candidatura pendente por utilizador.
 * - A badge "staff" só é concedida quando a candidatura for aprovada
 *   (revisão manual pela equipa — fora do âmbito do self-service).
 */
export async function applyForStaff(message: string): Promise<StaffApplication> {
  // A candidatura é criada server-side: o cliente nunca escolhe idUtilizador,
  // status, revistoPor ou permissões do documento.
  const trimmed = normalizeStaffApplicationMessage(message);
  const res = await fetchWithAppwriteAuth("/api/staff/apply", {
      method: "POST",
      body: JSON.stringify({ message: trimmed }),
    });
  const data = await res.json().catch(() => ({})) as {
    application?: StaffApplication;
    error?: string;
  };
  if (!res.ok || !data.application) {
    throw new Error(data.error || "Não foi possível enviar a candidatura.");
  }
  void logActivity("staff_applied");
  return data.application;
}

/**
 * Atualiza o país/moeda do utilizador no documento users (recolha por IP).
 * Devolve os dados recolhidos ou null se falhou. Usado quando a conta já
 * existe sem moeda (contas antigas) — ex: botão "Detetar país" na Faturação.
 */
export async function syncUserGeo(force = false): Promise<{
  pais?: string;
  codigoPais?: string;
  moeda?: string;
} | null> {
  try {
    const session = await getCurrentSession();
    const docs = await databases.listDocuments(databaseId, Collections.users, [
      Query.equal("idUtilizador", session.$id),
      Query.limit(1),
    ]);
    if (docs.documents.length === 0) return null;
    const doc = docs.documents[0];

    // Já sincronizado — devolve o estado atual sem escrever (poupa quota).
    // O botão manual "Detetar país" passa force=true para re-detetar por IP.
    const existingCode = String(doc.codigoPais ?? "");
    if (existingCode && !force) {
      return {
        pais: String(doc.pais ?? ""),
        codigoPais: existingCode,
        moeda: String(doc.moeda ?? "EUR"),
      };
    }

    // Guard só pelo codigoPais: a rota devolve sempre currency como
    // fallback ("EUR") mesmo quando o país não resolve — sem codigoPais
    // não há nada útil para persistir (evita writes vazios por sessão).
    const res = await fetchWithAppwriteAuth("/api/users/geo", {
      method: "POST",
      body: JSON.stringify({ force }),
    });
    if (!res.ok) return null;
    const geo = await res.json() as { pais?: string; codigoPais?: string; moeda?: string };
    if (!geo.codigoPais) return null;
    return geo;
  } catch {
    return null;
  }
}

/** Última candidatura ao staff do utilizador (ou null se nunca se candidatou). */
export async function getStaffApplicationStatus(): Promise<StaffApplication | null> {
  // A coleção staff_applications não é acessível pelo client SDK. A leitura
  // passa pela rota server-side, que deriva idUtilizador da sessão e só devolve o
  // documento do utilizador autenticado.
  try {
    const res = await fetchWithAppwriteAuth("/api/staff/status", {
      method: "GET",
    });
    if (!res.ok) return null;
    const data = await res.json() as { application?: StaffApplication | null };
    return data.application ?? null;
  } catch {
    return null;
  }
}

// ---------- Storage ----------

export function getFilePreviewUrl(_bucketId: string, fileId: string) {
  // Public images go through the Worker proxy instead of exposing the
  // Appwrite Storage URL directly. The proxy validates IDs, blocks hotlinks
  // and applies distributed download limits.
  return `/api/media/${encodeURIComponent(fileId)}`;
}

export async function uploadFile(bucketId: string, file: File) {
  // O upload passa por uma rota server-side para evitar que o multipart
  // chunked do SDK seja corrompido pelo proxy genérico /api/appwrite.
  const response = await fetchWithCsrf("/api/media/upload", {
    method: "POST",
    body: (() => {
      const form = new FormData();
      form.set("bucketId", bucketId);
      form.set("file", file, file.name);
      return form;
    })(),
  });
  const data = await response.json().catch(() => ({})) as {
    file?: { $id: string; name?: string; mimeType?: string; sizeOriginal?: number };
    error?: string;
  };
  if (!response.ok || !data.file?.$id) {
    throw new Error(data.error || "Não foi possível carregar a imagem.");
  }
  return data.file;
}

/**
 * Apaga um ficheiro de media de forma fiável (best-effort) através do
 * endpoint server-side DELETE /api/media/upload/[fileId] — que usa a API key
 * do servidor e valida a propriedade ($permissions) antes de apagar. Nunca
 * quebra a ação principal: se a limpeza falhar, o ficheiro antigo fica órfão
 * e é recolhido pela eliminação de conta.
 */
export async function deleteMediaFileServerSide(fileId: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const res = await fetchWithCsrf(`/api/media/upload/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      console.error(`[deleteMediaFileServerSide] DELETE ${fileId} returned ${res.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[deleteMediaFileServerSide] failed to delete file:", fileId, error);
    return false;
  }
}

// ---------- Avatar / Banner ----------

export async function updatePageAvatar(idPagina: string, fileId: string) {
  await requireOwnerOfPage(idPagina);
  const current = await databases.getDocument(databaseId, Collections.pages, idPagina);
  const previousFileId = String(current.idAvatar ?? "");
  const doc = await databases.updateDocument(databaseId, Collections.pages, idPagina, {
    idAvatar: fileId,
  });
  if (previousFileId && previousFileId !== fileId) {
    await deleteMediaFileServerSide(previousFileId);
  }
  void logActivity("avatar_updated", { nomeUtilizador: String(doc.nomeUtilizador ?? "") });
  return doc;
}

export async function updatePageBanner(idPagina: string, fileId: string) {
  await requireOwnerOfPage(idPagina);
  const current = await databases.getDocument(databaseId, Collections.pages, idPagina);
  const previousFileId = String(current.idBanner ?? "");
  const doc = await databases.updateDocument(databaseId, Collections.pages, idPagina, {
    idBanner: fileId,
  });
  if (previousFileId && previousFileId !== fileId) {
    await deleteMediaFileServerSide(previousFileId);
  }
  void logActivity("banner_updated", { nomeUtilizador: String(doc.nomeUtilizador ?? "") });
  return doc;
}

export async function removePageAvatar(idPagina: string) {
  await requireOwnerOfPage(idPagina);
  const pageDoc = await databases.getDocument(databaseId, Collections.pages, idPagina);
  const currentFileId = String(pageDoc.idAvatar ?? "");
  // Limpa primeiro a referência e só depois apaga o ficheiro: se o update
  // falhar, a página continua a apontar para um ficheiro existente (nunca
  // deixa uma imagem partida); se o apagar falhar, fica um órfão recolhido
  // pela eliminação de conta.
  const doc = await databases.updateDocument(databaseId, Collections.pages, idPagina, {
    idAvatar: "",
  });
  if (currentFileId) {
    await deleteMediaFileServerSide(currentFileId);
  }
  return doc;
}

export async function removePageBanner(idPagina: string) {
  await requireOwnerOfPage(idPagina);
  const pageDoc = await databases.getDocument(databaseId, Collections.pages, idPagina);
  const currentFileId = String(pageDoc.idBanner ?? "");
  // Mesma ordem segura do avatar: referência limpa antes de apagar o ficheiro.
  const doc = await databases.updateDocument(databaseId, Collections.pages, idPagina, {
    idBanner: "",
  });
  if (currentFileId) {
    await deleteMediaFileServerSide(currentFileId);
  }
  return doc;
}
