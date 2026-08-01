import { ID, Query, Models, OAuthProvider, Permission, Role } from "appwrite";

import { account, databases, storage, databaseId, Collections, Buckets, endpoint, projectId } from "./appwrite";
import { fetchWithCsrf } from "@/hooks/use-csrf";
import {
  Appearance,
  LinkItem,
  PageProfile,
  SocialLinks,
  SocialLinkEntry,
  UserAccount,
  AnalyticsData,
  TopDevice,
  SecurityLogEntry,
  SecurityLogInput,
} from "./types";
import { defaultAppearance, emptyAnalytics } from "./defaults";
import { sanitizeSocialEntries } from "./social";
import { sanitizeUrl } from "./sanitize";

type AppwriteDocument = Models.Document & Record<string, unknown>;

// ---------- Auth helpers ----------

async function getCurrentSessionOrThrow(): Promise<Models.User<Models.Preferences>> {
  return getCurrentSession();
}

async function createOwnedDocument<T extends Record<string, unknown>>(
  collectionId: string,
  data: T
) {
  const session = await getCurrentSessionOrThrow();
  return databases.createDocument(databaseId, collectionId, ID.unique(), data, [
    Permission.read(Role.user(session.$id)),
    Permission.update(Role.user(session.$id)),
    Permission.delete(Role.user(session.$id)),
  ]);
}

async function requireOwnerOfPage(pageId: string): Promise<void> {
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
}

// ---------- Auth ----------

export async function registerUser(email: string, password: string, name: string) {
  const newAccount = await account.create(ID.unique(), email, password, name);
  await account.createEmailPasswordSession(email, password);
  const existing = await databases.listDocuments(databaseId, Collections.users, [
    Query.equal("userId", newAccount.$id),
  ]);
  if (existing.documents.length === 0) {
    await databases.createDocument(databaseId, Collections.users, ID.unique(), {
      userId: newAccount.$id,
      email,
      displayName: name,
      plan: "free",
      createdAt: new Date().toISOString(),
    }, [
      Permission.read(Role.user(newAccount.$id)),
      Permission.update(Role.user(newAccount.$id)),
      Permission.delete(Role.user(newAccount.$id)),
    ]);
  }
  return newAccount;
}

export async function loginUser(email: string, password: string) {
  return account.createEmailPasswordSession(email, password);
}

export async function logoutUser() {
  return account.deleteSession("current");
}

export async function getCurrentSession() {
  return account.get();
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
  account.createOAuth2Session(
    provider,
    `${window.location.origin}/dashboard`,
    `${window.location.origin}/login`
  );
}

export function loginWithGoogle() {
  createOAuthSession(OAuthProvider.Google);
}

export function loginWithGitHub() {
  createOAuthSession(OAuthProvider.Github);
}

export async function checkAndSyncOAuthUser(user: Models.User<Models.Preferences>) {
  try {
    // Usa o server SDK via API route para criar/verificar o documento,
    // evitando problemas de permissão do client SDK.
    const res = await fetch("/api/auth/oauth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.$id,
        email: user.email,
        displayName: user.name || "Utilizador",
        createdAt: user.$createdAt || new Date().toISOString(),
      }),
      credentials: "include",
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
    plan: doc.plan as UserAccount["plan"],
  };
}

// ---------- Pages ----------

export async function createPage(profile: Omit<PageProfile, "published">) {
  const session = await getCurrentSession();
  const doc = await databases.createDocument(databaseId, Collections.pages, ID.unique(), {
    ...profile,
    userId: session.$id,
    published: false,
  }, [
    Permission.read(Role.user(session.$id)),
    Permission.update(Role.user(session.$id)),
    Permission.delete(Role.user(session.$id)),
  ]);
  // Create default theme and empty analytics for the page
  await createOwnedDocument(Collections.themes, {
    pageId: doc.$id,
    ...defaultAppearance(),
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
      topLinks: [],
      topCountries: [],
      topDevices: [],
      deviceLog: [],
      recentVisitors: [],
      hourlyStats: [],
      dailyStats: [],
    }),
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
  return databases.updateDocument(databaseId, Collections.pages, pageId, patch);
}

/**
 * Parse the socialJson field into either the legacy flat record or the new
 * structured list. Never trusts the raw payload — entries are normalized.
 */
function parseSocialJson(raw: unknown): {
  social?: SocialLinks;
  socialList?: SocialLinkEntry[];
} {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { socialList: sanitizeSocialEntries(parsed) };
    }
    if (parsed && typeof parsed === "object") {
      const legacy: SocialLinks = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") {
          (legacy as Record<string, string | undefined>)[key] = sanitizeUrl(value);
        }
      }
      return { social: legacy };
    }
  } catch {
    // Invalid JSON — ignore
  }
  return {};
}

function mapPageDocument(doc: AppwriteDocument): PageProfile & { $id: string } {
  const { social, socialList } = parseSocialJson(doc.socialJson);
  return {
    $id: doc.$id,
    username: String(doc.username),
    displayName: String(doc.displayName),
    bio: String(doc.bio ?? ""),
    avatar: doc.avatarId ? getFilePreviewUrl(Buckets.files, String(doc.avatarId)) : undefined,
    banner: doc.bannerId ? getFilePreviewUrl(Buckets.files, String(doc.bannerId)) : undefined,
    published: Boolean(doc.published),
    scheduledPublishAt: doc.scheduledPublishAt ? String(doc.scheduledPublishAt) : undefined,
    scheduledUnpublishAt: doc.scheduledUnpublishAt ? String(doc.scheduledUnpublishAt) : undefined,
    social,
    socialList,
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

export async function createLink(pageId: string, link: Omit<LinkItem, "id">) {
  await requireOwnerOfPage(pageId);

  // Server-side enforcement: count existing links for free plan users
  const session = await getCurrentSession();
  const userDocs = await databases.listDocuments(databaseId, Collections.users, [
    Query.equal("userId", session.$id),
    Query.limit(1),
  ]);
  const userPlan = (userDocs.documents[0]?.plan as string) ?? "free";

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

  return createOwnedDocument(Collections.links, {
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
  });
}

export async function updateLink(linkId: string, patch: Partial<Omit<LinkItem, "id">>) {
  const linkDoc = await databases.getDocument(databaseId, Collections.links, linkId);
  await requireOwnerOfPage(String(linkDoc.pageId));
  const appwritePatch: Record<string, unknown> = { ...patch };
  if ("image" in appwritePatch) {
    appwritePatch.imageId = appwritePatch.image;
    delete appwritePatch.image;
  }
  return databases.updateDocument(databaseId, Collections.links, linkId, appwritePatch);
}

export async function deleteLink(linkId: string) {
  const linkDoc = await databases.getDocument(databaseId, Collections.links, linkId);
  await requireOwnerOfPage(String(linkDoc.pageId));
  return databases.deleteDocument(databaseId, Collections.links, linkId);
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
    showSocial: Boolean(doc.showSocial),
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

  return databases.updateDocument(databaseId, Collections.themes, themeId, safePayload);
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

// ---------- Social Links ----------

/**
 * Persist the structured social network list.
 * Entries are normalized server-side (platform whitelist, URL() validation,
 * unsafe protocol blocking, order/status coercion) before being stored — the
 * client is never trusted.
 */
export async function updateSocialEntries(pageId: string, entries: SocialLinkEntry[]) {
  await requireOwnerOfPage(pageId);
  const safe = sanitizeSocialEntries(entries);
  return databases.updateDocument(databaseId, Collections.pages, pageId, {
    socialJson: JSON.stringify(safe),
  });
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
  const metrics: Partial<AnalyticsData> & { deviceLog?: string[] } = JSON.parse(String(doc.metricsJson ?? "{}"));

  // Compute topDevices from deviceLog (real device type data)
  let topDevices: TopDevice[];
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
    topDevices = Array.isArray(metrics.topDevices) ? metrics.topDevices : [];
  }

  return {
    views: Number(doc.views),
    clicks: Number(doc.clicks),
    ctr: Number(metrics.ctr ?? 0),
    followers: Number(doc.followers),
    weeklyGrowth: Number(metrics.weeklyGrowth ?? 0),
    monthlyGrowth: Number(metrics.monthlyGrowth ?? 0),
    topLinks: Array.isArray(metrics.topLinks) ? metrics.topLinks : [],
    topCountries: Array.isArray(metrics.topCountries) ? metrics.topCountries : [],
    topDevices,
    recentVisitors: Array.isArray(metrics.recentVisitors) ? metrics.recentVisitors : [],
    hourlyStats: Array.isArray(metrics.hourlyStats) ? metrics.hourlyStats : [],
    dailyStats: Array.isArray(metrics.dailyStats) ? metrics.dailyStats : [],
  };
}

// ---------- Storage ----------

export function getFilePreviewUrl(bucketId: string, fileId: string) {
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
}

export async function uploadFile(bucketId: string, file: File) {
  return storage.createFile(bucketId, ID.unique(), file);
}

export async function deleteFile(bucketId: string, fileId: string) {
  return storage.deleteFile(bucketId, fileId);
}

// ---------- Avatar / Banner ----------

export async function updatePageAvatar(pageId: string, fileId: string) {
  await requireOwnerOfPage(pageId);
  return databases.updateDocument(databaseId, Collections.pages, pageId, {
    avatarId: fileId,
  });
}

export async function updatePageBanner(pageId: string, fileId: string) {
  await requireOwnerOfPage(pageId);
  return databases.updateDocument(databaseId, Collections.pages, pageId, {
    bannerId: fileId,
  });
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
