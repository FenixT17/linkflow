import { ID, Query, Models, OAuthProvider, Permission, Role } from "appwrite";

import { account, databases, storage, databaseId, Collections, Buckets, endpoint, projectId, createOAuthAccount } from "./appwrite";
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
import { isBadgeId } from "./badges";
import { isStaffApplicationApproved, normalizeStaffApplicationMessage } from "./staff-security";

type AppwriteDocument = Models.Document & Record<string, unknown>;

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

async function requireOwnerOfPage(pageId: string): Promise<Models.User<Models.Preferences>> {
  const session = await getCurrentSessionOrThrow();
  try {
    const pageDoc = await databases.getDocument(databaseId, Collections.pages, pageId);
    if (!pageDoc || String(pageDoc.userId) !== session.$id) {
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
  countryCode?: string;
  currency?: string;
}> {
  try {
    const res = await fetch("/api/geo/lookup", { credentials: "include" });
    if (!res.ok) return {};
    return (await res.json()) as { country?: string; countryCode?: string; currency?: string };
  } catch {
    return {};
  }
}

export async function registerUser(email: string, password: string, name: string) {
  const response = await fetchWithCsrf("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  const data = await response.json().catch(() => ({})) as {
    user?: Models.User<Models.Preferences>;
    verificationSent?: boolean;
    error?: string;
  };
  if (!response.ok || !data.user) {
    throw new Error(data.error || "Não foi possível criar a conta.");
  }

  const provision = await fetchWithCsrf("/api/users/provision", {
    method: "POST",
    body: JSON.stringify({}),
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
        country: provisionData.profile.country,
        countryCode: provisionData.profile.countryCode,
        currency: provisionData.profile.currency,
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

export async function requestPasswordReset(_email: string): Promise<never> {
  throw new Error("A recuperação por email está temporariamente desativada.");
}

export async function completeEmailVerification(userId: string, secret: string) {
  return account.updateEmailVerification(userId, secret);
}

export async function completePasswordReset(userId: string, secret: string, password: string) {
  return account.updateRecovery(userId, secret, password);
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
  return data.user;
}

export async function logoutUser() {
  const response = await fetchWithCsrf("/api/auth/logout", { method: "POST" });
  if (!response.ok) {
    throw new Error("Não foi possível terminar a sessão.");
  }
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

export async function getCurrentSession() {
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

/**
 * Helper partilhado para iniciar OAuth2.
 *
 * - Devolve cedo com `?error=missing_project` quando o projectId não chegou
 *   ao cliente (em vez de chamar Appwrite que falharia silenciosamente).
 * - Não sobrepõe a failure URL com `?error=oauth_failed` para deixar o
 *   Appwrite anexar `error` + `error_description` reais à query string.
 *   Assim a página de login consegue mostrar a mensagem do Appwrite.
 */
function createOAuthSession(provider: OAuthProvider) {
  if (!projectId) {
    window.location.assign(`${window.location.origin}/login?error=missing_project`);
    return;
  }
  const providerKey = provider === OAuthProvider.Google ? "google" : "github";
  // The server route applies the distributed limit and owns the callback
  // allowlist. It then redirects to Appwrite's provider endpoint.
  window.location.assign(`/api/auth/oauth/start?provider=${providerKey}`);
}

export function loginWithGoogle() {
  createOAuthSession(OAuthProvider.Google);
}

export function loginWithGitHub() {
  createOAuthSession(OAuthProvider.Github);
}

async function fetchWithAppwriteAuth(url: string, options: RequestInit = {}): Promise<Response> {
  return fetchWithCsrf(url, options);
}

export async function checkAndSyncOAuthUser(user: Models.User<Models.Preferences>) {
  try {
    // M3: usa fetchWithCsrf (com header X-CSRF-Token) — o endpoint agora
    // valida CSRF. Usa o server SDK via API route para criar/verificar o
    // documento, evitando problemas de permissão do client SDK.
    const res = await fetchWithAppwriteAuth("/api/auth/oauth/sync", {
      method: "POST",
      body: JSON.stringify({
        userId: user.$id,
        email: user.email,
        displayName: user.name || "Utilizador",
        createdAt: user.$createdAt || new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("[checkAndSyncOAuthUser] API error:", data.error || res.status);
    }
  } catch (error) {
    // Não deve impedir o login OAuth — falha silenciosa.
    if (process.env.NODE_ENV === "development") {
      console.warn("[checkAndSyncOAuthUser] Failed to sync:", error);
    }
  }
}

export async function getUserProfile(userId: string): Promise<UserAccount | null> {
  const docs = await databases.listDocuments(databaseId, Collections.users, [
    Query.equal("userId", userId),
  ]);
  if (docs.documents.length === 0) return null;
  const doc = docs.documents[0] as AppwriteDocument;
  return {
    email: String(doc.email),
    displayName: String(doc.displayName),
    createdAt: String(doc.createdAt),
    plan: ["free", "pro", "business", "enterprise"].includes(String(doc.plan))
      ? (String(doc.plan) as UserAccount["plan"])
      : "free",
    country: doc.country ? String(doc.country) : undefined,
    countryCode: doc.countryCode ? String(doc.countryCode) : undefined,
    currency: doc.currency ? String(doc.currency) : undefined,
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
 * Traduz o 409 do Appwrite (índice único no username — "Document with the
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

export async function createPage(profile: Omit<PageProfile, "published">) {
  const session = await getCurrentSession();

  // Idempotente: se o utilizador JÁ tem uma página (ex: dupla submissão do
  // botão ou tentativa anterior que ficou a meio), atualiza-a em vez de
  // criar outra — o índice único no username rejeitaria a segunda com
  // "Document with the requested ID ... already exists" (409).
  const existing = await getPageByUserId(session.$id).catch(() => null);
  if (existing) {
    try {
      // updatePage já regista a atividade (page_updated) e faz o owner check.
      return await updatePage(existing.$id, {
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio ?? "",
        pageType: profile.pageType ?? existing.pageType ?? "minimal",
        pageTemplate: profile.pageTemplate ?? existing.pageTemplate ?? "template1",
      });
    } catch (error) {
      // Username alterado para um já usado por OUTRO utilizador → 409 cru.
      throwPageConflict(error);
    }
  }

  let doc: AppwriteDocument;
  try {
    doc = await databases.createDocument(databaseId, Collections.pages, ID.unique(), {
      ...profile,
      userId: session.$id,
      published: false,
      pageType: profile.pageType ?? "minimal",
      pageTemplate: profile.pageTemplate ?? "template1",
    }, [
      Permission.read(Role.user(session.$id)),
      Permission.update(Role.user(session.$id)),
      Permission.delete(Role.user(session.$id)),
    ]);
  } catch (error) {
    // Só o createDocument da página traduz o 409 para "username em uso" — os
    // 409 dos passos seguintes (theme/analytics) são outra coisa (ver abaixo).
    throwPageConflict(error);
  }
  // Registo de atividade: página criada
  void logActivity("page_created", { username: profile.username, displayName: profile.displayName });

  // Create default theme and empty analytics for the page.
  // Auto-cura: se uma tentativa parcial anterior já os criou (409 no índice
  // único de pageId), NÃO é um conflito de username — ignoramos e seguimos
  // (getThemeByPageId/getAnalyticsByPageId têm fallbacks para dados ausentes).
  //
  // NOTA: o schema Appwrite da coleção themes tem o atributo `theme` como
  // OBRIGATÓRIO (required=true, default "glass") — mesmo com o sistema atual
  // a usar apenas Liquid Glass, sem o campo o createDocument falha com
  // "Invalid document structure: Missing required attribute \"theme\"".
  await createOwnedDocument(Collections.themes, {
    pageId: doc.$id,
    theme: "glass",
    ...defaultAppearance(),
  }).catch((error) => {
    if (!isAlreadyExistsError(error)) throw error;
  });
  await createOwnedDocument(Collections.analytics, {
    pageId: doc.$id,
    views: 0,
    clicks: 0,
    followers: 0,
    metricsJson: JSON.stringify({
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
    }),
  }).catch((error) => {
    if (!isAlreadyExistsError(error)) throw error;
  });

  return doc;
}

export async function getPageByUsername(username: string): Promise<(PageProfile & { $id: string }) | null> {
  const docs = await databases.listDocuments(databaseId, Collections.pages, [
    Query.equal("username", username.toLowerCase()),
    Query.equal("published", true),
  ]);
  if (docs.documents.length === 0) return null;
  const doc = docs.documents[0] as AppwriteDocument;
  return mapPageDocument(doc);
}

export async function getPageByUserId(userId: string): Promise<(PageProfile & { $id: string }) | null> {
  const docs = await databases.listDocuments(databaseId, Collections.pages, [
    Query.equal("userId", userId),
  ]);
  if (docs.documents.length === 0) return null;
  const doc = docs.documents[0] as AppwriteDocument;
  return mapPageDocument(doc);
}

export async function updatePage(pageId: string, patch: Partial<PageProfile>) {
  await requireOwnerOfPage(pageId);
  const doc = await databases.updateDocument(databaseId, Collections.pages, pageId, patch);
  // Registo de atividade: página atualizada (inclui publicar/despublicar)
  if (typeof patch.published === "boolean") {
    void logActivity(
      patch.published ? "page_published" : "page_unpublished",
      { username: String(doc.username ?? "") }
    );
  } else {
    void logActivity("page_updated", { username: String(doc.username ?? "") });
  }
  return doc;
}

function mapPageDocument(doc: AppwriteDocument): PageProfile & { $id: string } {
  return {
    $id: doc.$id,
    username: String(doc.username),
    displayName: String(doc.displayName),
    bio: String(doc.bio ?? ""),
    avatar: doc.avatarId ? getFilePreviewUrl(Buckets.files, String(doc.avatarId)) : undefined,
    banner: doc.bannerId ? getFilePreviewUrl(Buckets.files, String(doc.bannerId)) : undefined,
    published: Boolean(doc.published),
    pageType: (doc.pageType as PageType) ?? "minimal",
    pageTemplate: (doc.pageTemplate as PageTemplateId) ?? "template1",
    badges: Array.isArray(doc.badges)
      ? (doc.badges as string[]).filter((badge) => badge !== "staff")
      : [],
    scheduledPublishAt: doc.scheduledPublishAt ? String(doc.scheduledPublishAt) : undefined,
    scheduledUnpublishAt: doc.scheduledUnpublishAt ? String(doc.scheduledUnpublishAt) : undefined,
  };
}

// ---------- Links ----------

export async function getLinksByPageId(pageId: string): Promise<LinkItem[]> {
  if (!pageId) return [];
  const docs = await databases.listDocuments(databaseId, Collections.links, [
    Query.equal("pageId", pageId),
    Query.orderAsc("order"),
  ]);
  return docs.documents.map((doc) => mapLinkDocument(doc as AppwriteDocument));
}

function mapLinkDocument(doc: AppwriteDocument): LinkItem {
  return {
    id: doc.$id,
    type: doc.type as LinkItem["type"],
    title: String(doc.title),
    description: doc.description ? String(doc.description) : undefined,
    url: String(doc.url),
    icon: doc.icon ? String(doc.icon) : undefined,
    color: doc.color ? String(doc.color) : undefined,
    image: doc.imageId ? getFilePreviewUrl(Buckets.files, String(doc.imageId)) : undefined,
    animation: (doc.animation as LinkItem["animation"]) ?? "none",
    active: Boolean(doc.active),
    visible: Boolean(doc.visible),
    newTab: Boolean(doc.newTab),
    order: Number(doc.order),
    clicks: Number(doc.clicks),
    scheduledFor: doc.scheduledFor ? String(doc.scheduledFor) : undefined,
  };
}

// ---------- M7: cache em memória do plano do utilizador ----------
// Evita 2-3 queries Appwrite por mutação autenticada (owner check + user
// doc + listDocuments). TTL curto — só cacheia dados de quota, nunca
// dados sensíveis. Invalidação implícita pelo TTL (30s).
const planCache = new Map<string, { plan: string; expiresAt: number }>();
const PLAN_CACHE_TTL_MS = 30_000;

async function getCachedUserPlan(sessionId: string): Promise<string> {
  const cached = planCache.get(sessionId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.plan;
  }
  const userDocs = await databases.listDocuments(databaseId, Collections.users, [
    Query.equal("userId", sessionId),
    Query.limit(1),
  ]);
  const plan = (userDocs.documents[0]?.plan as string) ?? "free";
  planCache.set(sessionId, { plan, expiresAt: Date.now() + PLAN_CACHE_TTL_MS });
  // Evita crescimento infinito do mapa
  if (planCache.size > 500) {
    const now = Date.now();
    for (const [key, entry] of planCache) {
      if (entry.expiresAt <= now) planCache.delete(key);
    }
  }
  return plan;
}

export async function createLink(pageId: string, link: Omit<LinkItem, "id">) {
  const session = await requireOwnerOfPage(pageId);

  // Server-side enforcement: count existing links for free plan users
  const userPlan = await getCachedUserPlan(session.$id);

  if (userPlan === "free") {
    const existingLinks = await databases.listDocuments(databaseId, Collections.links, [
      Query.equal("pageId", pageId),
      Query.limit(4), // Só precisamos de saber se há 3 ou mais
    ]);
    if (existingLinks.total >= 3) {
      const error = new Error("Limite de links do plano Gratuito atingido (máx. 3). Faça upgrade para adicionar mais.");
      (error as Error & { status?: number }).status = 403;
      throw error;
    }
  }

  const created = await createOwnedDocument(Collections.links, {
    pageId,
    type: link.type,
    title: link.title,
    url: link.url,
    description: link.description,
    icon: link.icon,
    color: link.color,
    imageId: link.image,
    animation: link.animation,
    active: link.active,
    visible: link.visible,
    newTab: link.newTab,
    order: link.order,
    clicks: link.clicks,
    scheduledFor: link.scheduledFor,
  }, session);
  // Registo de atividade: link criado
  void logActivity("link_created", { title: link.title });
  return created;
}

export async function updateLink(linkId: string, patch: Partial<Omit<LinkItem, "id">>) {
  const linkDoc = await databases.getDocument(databaseId, Collections.links, linkId);
  await requireOwnerOfPage(String(linkDoc.pageId));
  const appwritePatch: Record<string, unknown> = { ...patch };
  if ("image" in appwritePatch) {
    appwritePatch.imageId = appwritePatch.image;
    delete appwritePatch.image;
  }
  const doc = await databases.updateDocument(databaseId, Collections.links, linkId, appwritePatch);
  // Registo de atividade: link atualizado — mas NÃO quando é apenas a ordem
  // (o drag-reorder dispara um updateLink por link e inundaria o feed).
  const meaningfulKeys = Object.keys(appwritePatch).filter((k) => k !== "order");
  if (meaningfulKeys.length > 0) {
    void logActivity("link_updated", { title: String(doc.title ?? "") });
  }
  return doc;
}

export async function deleteLink(linkId: string) {
  const linkDoc = await databases.getDocument(databaseId, Collections.links, linkId);
  await requireOwnerOfPage(String(linkDoc.pageId));
  await databases.deleteDocument(databaseId, Collections.links, linkId);
  // Registo de atividade: link eliminado
  void logActivity("link_deleted", { title: String(linkDoc.title ?? "") });
}

// ---------- Themes ----------

export async function getThemeByPageId(pageId: string): Promise<Appearance & { $id: string }> {
  const docs = await databases.listDocuments(databaseId, Collections.themes, [
    Query.equal("pageId", pageId),
  ]);
  if (docs.documents.length === 0) {
    return { ...defaultAppearance(), $id: "" };
  }
  const doc = docs.documents[0] as AppwriteDocument;
  return {
    $id: doc.$id,
    blur: Number(doc.blur),
    rounded: Number(doc.rounded),
    linkOpacity: Number(doc.linkOpacity),
    backgroundColor: doc.backgroundColor ? String(doc.backgroundColor) : undefined,
    cardColor: doc.cardColor ? String(doc.cardColor) : undefined,
    textColor: doc.textColor ? String(doc.textColor) : undefined,
    accentColor: doc.accentColor ? String(doc.accentColor) : undefined,
    fontFamily: doc.fontFamily ? String(doc.fontFamily) : undefined,
    fontSize: Number(doc.fontSize),
    buttonRadius: Number(doc.buttonRadius),
    buttonWidth: String(doc.buttonWidth) as Appearance["buttonWidth"],
    buttonHeight: String(doc.buttonHeight) as Appearance["buttonHeight"],
    buttonStyle: String(doc.buttonStyle) as Appearance["buttonStyle"],
    shadow: String(doc.shadow) as Appearance["shadow"],
    showAvatar: Boolean(doc.showAvatar),
    showBio: Boolean(doc.showBio),
    showSocial: doc.showSocial !== undefined ? Boolean(doc.showSocial) : true,
    spacing: Number(doc.spacing),
    glassOpacity: doc.glassOpacity !== undefined ? Number(doc.glassOpacity) : 35,
    glassBlur: doc.glassBlur !== undefined ? Number(doc.glassBlur) : 25,
    glassStrength: doc.glassStrength !== undefined ? Number(doc.glassStrength) : 50,
  };
}

/** Campos que existem no schema Appwrite da coleção themes */
const THEME_SAFE_FIELDS = [
  "blur", "rounded", "linkOpacity",
  "backgroundColor", "cardColor", "textColor", "accentColor",
  "fontFamily", "fontSize", "buttonRadius", "buttonWidth", "buttonHeight", "buttonStyle", "shadow",
  "showAvatar", "showBio", "showSocial", "spacing",
  "glassOpacity", "glassBlur", "glassStrength",
] as const;

export async function updateTheme(themeId: string, appearance: Appearance) {
  const themeDoc = await databases.getDocument(databaseId, Collections.themes, themeId);
  await requireOwnerOfPage(String(themeDoc.pageId));

  // Apenas envia os campos que existem no schema Appwrite.
  const safePayload: Record<string, unknown> = {};
  for (const field of THEME_SAFE_FIELDS) {
    if (field in appearance) {
      safePayload[field] = (appearance as unknown as Record<string, unknown>)[field];
    }
  }

  const doc = await databases.updateDocument(databaseId, Collections.themes, themeId, safePayload);
  // Registo de atividade: aparência atualizada (throttled para sliders)
  void logActivity("appearance_updated");
  return doc;
}

// ---------- Security Logs ----------

export async function createSecurityLog(input: SecurityLogInput) {
  // Security logs must be created server-side so the userId is derived from the session.
  // Pre-login (anonymous) events are sent to a dedicated endpoint that does not
  // accept a client-provided userId and is rate-limited by IP.
  const isAnonymous = input.userId === "anonymous";
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

export async function getAnalyticsByPageId(pageId: string): Promise<AnalyticsData> {
  const docs = await databases.listDocuments(databaseId, Collections.analytics, [
    Query.equal("pageId", pageId),
  ]);
  const doc = docs.documents[0] as AppwriteDocument | undefined;
  if (!doc) {
    return emptyAnalytics();
  }
  const metrics: Partial<AnalyticsData> & { deviceLog?: string[]; visitorSet?: string[] } = JSON.parse(String(doc.metricsJson ?? "{}"));

  // topDevices: agregado real (contagens por tipo). Fallback: deviceLog legado.
  let topDevices: TopDevice[];
  const storedDevices = Array.isArray(metrics.topDevices) ? metrics.topDevices : [];
  if (storedDevices.length > 0) {
    const total = storedDevices.reduce((sum, d) => sum + (d.count || 0), 0);
    topDevices = storedDevices.map((d) => ({
      type: d.type,
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
      topDevices = ["mobile", "desktop", "tablet"].map((type) => ({
        type: type as TopDevice["type"],
        count: counts[type],
        percentage: Math.round((counts[type] / total) * 100),
      }));
    } else {
      topDevices = [];
    }
  }

  const uniqueVisitors = Number(metrics.uniqueVisitors ?? 0);

  return {
    views: Number(doc.views),
    clicks: Number(doc.clicks),
    ctr: Number(metrics.ctr ?? 0),
    followers: Number(doc.followers),
    uniqueVisitors,
    visitorGrowth: Number(metrics.visitorGrowth ?? 0),
    weeklyGrowth: Number(metrics.weeklyGrowth ?? 0),
    monthlyGrowth: Number(metrics.monthlyGrowth ?? 0),
    topLinks: (Array.isArray(metrics.topLinks) ? metrics.topLinks : []).sort((a, b) => b.clicks - a.clicks),
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
      userId: session.$id,
      action,
      details: details ? JSON.stringify(details).slice(0, 2000) : "",
      ipAddress: ip ?? "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
      createdAt: new Date().toISOString(),
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
      Query.equal("userId", session.$id),
      Query.orderDesc("createdAt"),
      Query.limit(Math.min(Math.max(limit, 1), 50)),
    ]);
    return docs.documents.map((doc) => ({
      $id: doc.$id,
      userId: String(doc.userId ?? ""),
      action: doc.action as ActivityAction,
      details: doc.details ? String(doc.details) : undefined,
      ipAddress: doc.ipAddress ? String(doc.ipAddress) : undefined,
      userAgent: doc.userAgent ? String(doc.userAgent) : undefined,
      createdAt: String(doc.createdAt ?? ""),
    }));
  } catch {
    return [];
  }
}

// ---------- Badges ----------

/** Badges concedidas APENAS pela equipa (nunca self-service). */
const TEAM_ONLY_BADGES = new Set<string>(["early", "partner"]);

/**
 * Concede uma badge à página do utilizador autenticado, respeitando as
 * regras de desbloqueio:
 * - verified / supporter: self-service (doação simulada — fluxo da aba Badges).
 * - staff: SÓ depois de a candidatura estar aprovada (status "approved").
 * - pro: SÓ se a conta tiver plano pago (registo em users).
 * - early / partner: exclusivas da equipa — sempre negadas ao utilizador.
 *
 * O badgeId é validado contra o registo (isBadgeId) antes de qualquer escrita,
 * e o userId é sempre derivado da sessão autenticada (nunca do body).
 */
export async function grantBadge(badgeId: string): Promise<boolean> {
  if (!isBadgeId(badgeId)) {
    throw new Error("Badge desconhecida.");
  }
  if (TEAM_ONLY_BADGES.has(badgeId)) {
    throw new Error("Esta badge é concedida apenas pela equipa.");
  }

  const session = await getCurrentSession();

  // Regra da badge staff: só após aprovação da candidatura
  if (badgeId === "staff") {
    const application = await getStaffApplicationStatus();
    if (!application || !isStaffApplicationApproved(application)) {
      throw new Error("A badge Staff só é concedida após aprovação da candidatura.");
    }
  }

  // Regra da badge pro: só com plano pago (origem real no registo users)
  if (badgeId === "pro") {
    const profile = await getUserProfile(session.$id);
    if (!profile || profile.plan === "free") {
      throw new Error("A badge Pro requer um plano pago.");
    }
  }

  const page = await getPageByUserId(session.$id);
  if (!page) {
    throw new Error("Cria primeiro a tua página para desbloquear badges.");
  }
  await requireOwnerOfPage(page.$id);

  // Nota: read-modify-write no array — a doação sequencial (verified depois
  // supporter) evita corridas na prática. Não há append atómico no client SDK.
  const badges = Array.isArray(page.badges) ? page.badges.filter((badge) => badge !== "staff") : [];
  if (badgeId === "staff") {
    // A staff approval is authoritative server data; this client function no
    // longer writes the staff marker into the user-editable pages document.
    return false;
  }
  if (badges.includes(badgeId)) return false;
  await databases.updateDocument(databaseId, Collections.pages, page.$id, {
    badges: [...badges, badgeId],
  });
  void logActivity("badge_earned", { badge: badgeId });
  return true;
}

/**
 * Remove uma badge da página (usado para sincronizar a badge pro com o plano).
 */
export async function revokeBadge(badgeId: string): Promise<void> {
  const session = await getCurrentSession();
  const page = await getPageByUserId(session.$id);
  if (!page) return;
  await requireOwnerOfPage(page.$id);
  const badges = Array.isArray(page.badges) ? page.badges.filter((badge) => badge !== "staff") : [];
  if (!badges.includes(badgeId)) return;
  await databases.updateDocument(databaseId, Collections.pages, page.$id, {
    badges: badges.filter((b) => b !== badgeId),
  });
}

/**
 * Cria uma candidatura ao staff (coleção staff_applications).
 * - Só permite uma candidatura pendente por utilizador.
 * - A badge "staff" só é concedida quando a candidatura for aprovada
 *   (revisão manual pela equipa — fora do âmbito do self-service).
 */
export async function applyForStaff(message: string): Promise<StaffApplication> {
  // A candidatura é criada server-side: o cliente nunca escolhe userId,
  // status, reviewedBy ou permissões do documento.
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
  country?: string;
  countryCode?: string;
  currency?: string;
} | null> {
  try {
    const session = await getCurrentSession();
    const docs = await databases.listDocuments(databaseId, Collections.users, [
      Query.equal("userId", session.$id),
      Query.limit(1),
    ]);
    if (docs.documents.length === 0) return null;
    const doc = docs.documents[0];

    // Já sincronizado — devolve o estado atual sem escrever (poupa quota).
    // O botão manual "Detetar país" passa force=true para re-detetar por IP.
    const existingCode = String(doc.countryCode ?? "");
    if (existingCode && !force) {
      return {
        country: String(doc.country ?? ""),
        countryCode: existingCode,
        currency: String(doc.currency ?? "EUR"),
      };
    }

    // Guard só pelo countryCode: a rota devolve sempre currency como
    // fallback ("EUR") mesmo quando o país não resolve — sem countryCode
    // não há nada útil para persistir (evita writes vazios por sessão).
    const res = await fetchWithAppwriteAuth("/api/users/geo", {
      method: "POST",
      body: JSON.stringify({ force }),
    });
    if (!res.ok) return null;
    const geo = await res.json() as { country?: string; countryCode?: string; currency?: string };
    if (!geo.countryCode) return null;
    return geo;
  } catch {
    return null;
  }
}

/** Última candidatura ao staff do utilizador (ou null se nunca se candidatou). */
export async function getStaffApplicationStatus(): Promise<StaffApplication | null> {
  // A coleção staff_applications não é acessível pelo client SDK. A leitura
  // passa pela rota server-side, que deriva userId da sessão e só devolve o
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

export function getFilePreviewUrl(bucketId: string, fileId: string) {
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
}

export async function uploadFile(bucketId: string, file: File) {
  // Sessão 36 (least-privilege): o bucket NÃO tem update/delete: users() —
  // define permissões POR FICHEIRO para o dono. Sem isto, o ficheiro herdaria
  // apenas read(any) do bucket e o dono não conseguiria apagá-lo/substituí-lo;
  // antes (bucket com update/delete users()) qualquer utilizador podia apagar
  // ficheiros de terceiros.
  const session = await getCurrentSession();
  return storage.createFile(bucketId, ID.unique(), file, [
    Permission.read(Role.any()),
    Permission.update(Role.user(session.$id)),
    Permission.delete(Role.user(session.$id)),
  ]);
}

export async function deleteFile(bucketId: string, fileId: string) {
  return storage.deleteFile(bucketId, fileId);
}

// ---------- Avatar / Banner ----------

export async function updatePageAvatar(pageId: string, fileId: string) {
  await requireOwnerOfPage(pageId);
  const doc = await databases.updateDocument(databaseId, Collections.pages, pageId, {
    avatarId: fileId,
  });
  void logActivity("avatar_updated", { username: String(doc.username ?? "") });
  return doc;
}

export async function updatePageBanner(pageId: string, fileId: string) {
  await requireOwnerOfPage(pageId);
  const doc = await databases.updateDocument(databaseId, Collections.pages, pageId, {
    bannerId: fileId,
  });
  void logActivity("banner_updated", { username: String(doc.username ?? "") });
  return doc;
}

export async function removePageAvatar(pageId: string) {
  await requireOwnerOfPage(pageId);
  const pageDoc = await databases.getDocument(databaseId, Collections.pages, pageId);
  const currentFileId = String(pageDoc.avatarId ?? "");
  if (currentFileId) {
    await deleteFile(Buckets.files, currentFileId).catch(() => {});
  }
  return databases.updateDocument(databaseId, Collections.pages, pageId, {
    avatarId: "",
  });
}

export async function removePageBanner(pageId: string) {
  await requireOwnerOfPage(pageId);
  const pageDoc = await databases.getDocument(databaseId, Collections.pages, pageId);
  const currentFileId = String(pageDoc.bannerId ?? "");
  if (currentFileId) {
    await deleteFile(Buckets.files, currentFileId).catch(() => {});
  }
  return databases.updateDocument(databaseId, Collections.pages, pageId, {
    bannerId: "",
  });
}
