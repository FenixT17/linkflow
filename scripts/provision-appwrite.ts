import { Client, Databases, Storage, Permission, Role, DatabasesIndexType } from "node-appwrite";
import dotenv from "dotenv";
import { ensureBucketWithPublicRead } from "./lib/public-bucket";

dotenv.config({ path: ".env.local" });

// Convention: NEXT_PUBLIC_APPWRITE_* is the canonical name (same as the runtime
// code and .env.example). Legacy non-prefixed aliases are accepted for backwards
// compatibility with older .env.local files.
const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
  process.env.APPWRITE_ENDPOINT ??
  "https://cloud.appwrite.io/v1";
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ??
  process.env.APPWRITE_DATABASE_ID ??
  "linkflow";

if (!projectId || !apiKey) {
  console.error(
    "Missing required environment variables: NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY"
  );
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithIdempotency<T>(fn: () => Promise<T>, name: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error: unknown) {
    const err = error instanceof Error ? (error as Error & { code?: number }) : undefined;
    if (err?.code === 409 || err?.message?.includes("already exists")) {
      console.log(`   ↳ ${name} already exists, skipping.`);
      return undefined;
    }
    throw error;
  }
}

interface AppwriteAttribute {
  status: string;
  key: string;
}

async function waitForAttributes(collectionId: string, attributeNames: string[]) {
  console.log(`   ↳ Waiting for attributes in ${collectionId}...`);
  let ready = false;
  let attempts = 0;
  while (!ready && attempts < 30) {
    const { attributes } = await databases.listAttributes(databaseId, collectionId);
    const readyNames = (attributes as unknown as AppwriteAttribute[])
      .filter((a) => a.status === "available")
      .map((a) => a.key);
    if (attributeNames.every((name) => readyNames.includes(name))) {
      ready = true;
      break;
    }
    await sleep(1000);
    attempts++;
  }
  if (!ready) {
    console.warn(`   ↳ Some attributes in ${collectionId} were not ready in time.`);
  }
}

/**
 * Cria a coleção ou, se já existir, ATUALIZA as permissões para as novas
 * (least-privilege). Sem isto, o script era idempotente e as coleções já
 * existentes mantinham permissões permissivas (read/update/delete: users())
 * que, sendo ADITIVAS às permissões por documento, expunham todos os dados
 * a qualquer utilizador autenticado.
 */
async function createCollection(collectionId: string, name: string, permissions: string[], documentSecurity = true) {
  const created = await runWithIdempotency(
    () =>
      databases.createCollection(databaseId, collectionId, name, permissions, documentSecurity),
    `Collection ${collectionId}`
  );
  if (created) return created;
  // Já existe — re-aplica as permissões pretendidas (updateCollection
  // substitui o array de permissões completo). documentSecurity mantém-se.
  console.log(`   ↳ Collection ${collectionId} exists — updating permissions (least-privilege)...`);
  return databases.updateCollection(
    databaseId,
    collectionId,
    name,
    permissions,
    documentSecurity
  );
}

async function createStringAttribute(
  collectionId: string,
  key: string,
  size: number,
  required: boolean,
  defaultValue?: string
) {
  // NOTA: o default é passado mesmo para atributos obrigatórios — o Appwrite
  // suporta defaults em atributos required (ex: themes.theme = "glass").
  // Antes, `required ? undefined : defaultValue` descartava o default, o que
  // fazia o createDocument sem o campo falhar com "Missing required attribute".
  // NOTA: o Appwrite NÃO permite default em atributos obrigatórios
  // ("Cannot set default value for required attribute"). Por isso o default
  // só é passado quando required=false — para required, os documentos têm de
  // enviar o valor explicitamente (ex: createPage envia theme: "glass").
  return runWithIdempotency(
    () =>
      databases.createStringAttribute(databaseId, collectionId, key, size, required, required ? undefined : defaultValue),
    `String attribute ${collectionId}.${key}`
  );
}

async function createStringArrayAttribute(
  collectionId: string,
  key: string,
  size: number,
  required: boolean
) {
  return runWithIdempotency(
    () => databases.createStringAttribute(databaseId, collectionId, key, size, required, undefined, true),
    `String[] attribute ${collectionId}.${key}`
  );
}

async function createBooleanAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: boolean
) {
  return runWithIdempotency(
    () =>
      databases.createBooleanAttribute(databaseId, collectionId, key, required, required ? undefined : defaultValue),
    `Boolean attribute ${collectionId}.${key}`
  );
}

async function createIntegerAttribute(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue?: number
) {
  return runWithIdempotency(
    () =>
      databases.createIntegerAttribute(databaseId, collectionId, key, required, required ? undefined : defaultValue),
    `Integer attribute ${collectionId}.${key}`
  );
}

async function createDatetimeAttribute(
  collectionId: string,
  key: string,
  required: boolean
) {
  return runWithIdempotency(
    () =>
      databases.createDatetimeAttribute(databaseId, collectionId, key, required),
    `Datetime attribute ${collectionId}.${key}`
  );
}

/**
 * Backfill: garante que um atributo string JÁ EXISTENTE tem o default
 * pretendido. Necessário porque versões antigas do createStringAttribute
 * descartavam o default em atributos obrigatórios (required ? undefined :
 * defaultValue) — ex: themes.theme ficou com default:null, o que fazia o
 * createDocument sem o campo falhar com "Missing required attribute".
 */
async function ensureStringAttributeDefault(
  collectionId: string,
  key: string,
  required: boolean,
  defaultValue: string
) {
  try {
    const { attributes } = await databases.listAttributes(databaseId, collectionId);
    const attr = (attributes as unknown as Array<{ key: string; required?: boolean; default?: unknown }>).find(
      (a) => a.key === key
    );
    if (!attr) {
      console.log(`   ↳ ${collectionId}.${key} not found, skipping backfill.`);
      return;
    }
    const currentDefault = attr.default as unknown;
    if (currentDefault === defaultValue) {
      console.log(`   ↳ ${collectionId}.${key} default already "${defaultValue}", skipping.`);
      return;
    }
    // O `required` pretendido é o que o chamador passa (o default só é
    // permitido em atributos não-obrigatórios no Appwrite).
    await databases.updateStringAttribute(
      databaseId,
      collectionId,
      key,
      required,
      defaultValue
    );
    console.log(`   ↳ ${collectionId}.${key} updated (required=${required}, default="${defaultValue}").`);
  } catch (error: unknown) {
    // Falha não bloqueante — o provision continua; apenas avisa.
    console.warn(`   ↳ Could not backfill default for ${collectionId}.${key}: ${(error as Error).message}`);
  }
}

type IndexType = "key" | "unique" | "fulltext" | "spatial";

async function createIndex(collectionId: string, key: string, type: IndexType, attributes: string[]) {
  return runWithIdempotency(
    () =>
      databases.createIndex(databaseId, collectionId, key, type as DatabasesIndexType, attributes),
    `Index ${collectionId}.${key}`
  );
}


async function provision() {
  console.log("🚀 Provisioning LinkFlow on Appwrite Cloud...\n");

  // 1. Database
  console.log("📦 Database");
  try {
    await databases.create(databaseId, "LinkFlow SaaS");
  } catch (error: unknown) {
    const err = error instanceof Error ? (error as Error & { code?: number }) : undefined;
    const message = err?.message ?? String(error);
    const isAlreadyExists = err?.code === 409 || message.includes("already exists");
    // Free plan: when the database limit is reached, the `linkflow` database is
    // typically already provisioned. Continue with collections/attributes/bucket;
    // if the database truly does not exist, the next step fails loudly.
    const isPlanLimit = message.includes("maximum number of databases allowed");
    if (isAlreadyExists || isPlanLimit) {
      console.log(`   ↳ Database step skipped (already exists or plan limit reached).`);
    } else {
      throw error;
    }
  }

  // 2. Users collection (custom profile data)
  // Server-only: nenhum create/update/delete/read ao nível da coleção.
  // O perfil é criado/atualizado via API routes com API key; o browser recebe
  // apenas Permission.read(Role.user(owner)) no próprio documento.
  console.log("\n👤 Collection: users");
  await createCollection("users", "Users", [], true);
  await createStringAttribute("users", "userId", 255, true);
  await createStringAttribute("users", "email", 255, true);
  await createStringAttribute("users", "displayName", 255, true);
  await createStringAttribute("users", "plan", 32, true, "free");
  await createStringAttribute("users", "country", 128, false, "");
  await createStringAttribute("users", "countryCode", 8, false, "");
  await createStringAttribute("users", "currency", 8, false, "EUR");
  await createDatetimeAttribute("users", "createdAt", true);
  await waitForAttributes("users", ["userId", "email", "displayName", "plan", "country", "countryCode", "currency", "createdAt"]);
  await createIndex("users", "idx_users_userId", "unique", ["userId"]);
  await createIndex("users", "idx_users_email", "unique", ["email"]);

  // 3. Pages collection
  // Sessão 36: só create ao nível da coleção; o acesso é por documento
  // (Role.user(owner)). Páginas públicas são servidas por rotas server-side
  // (server SDK/API key) que validam published antes de devolver dados.
  console.log("\n📄 Collection: pages");
  await createCollection(
    "pages",
    "Pages",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("pages", "userId", 255, true);
  await createStringAttribute("pages", "username", 255, true);
  await createStringAttribute("pages", "displayName", 255, true);
  await createStringAttribute("pages", "bio", 4096, false);
  await createStringAttribute("pages", "avatarId", 255, false);
  await createStringAttribute("pages", "bannerId", 255, false);
  await createBooleanAttribute("pages", "published", true, false);
  await createStringAttribute("pages", "pageType", 32, false, "minimal");
  await createStringAttribute("pages", "pageTemplate", 32, false, "template1");
  await createStringArrayAttribute("pages", "badges", 32, false);
  await createDatetimeAttribute("pages", "scheduledPublishAt", false);
  await createDatetimeAttribute("pages", "scheduledUnpublishAt", false);
  await waitForAttributes("pages", ["userId", "username", "displayName", "bio", "avatarId", "bannerId", "published", "pageType", "pageTemplate", "badges", "scheduledPublishAt", "scheduledUnpublishAt"]);
  await createIndex("pages", "idx_pages_userId", "key", ["userId"]);
  await createIndex("pages", "idx_pages_username", "unique", ["username"]);

  // 4. Links collection
  // Sessão 36: só create ao nível da coleção. O dono lê/edita/apaga os SEUS
  // links via permissões por documento. Links públicos são servidos por rotas
  // server-side após verificar que a página está publicada.
  console.log("\n🔗 Collection: links");
  await createCollection(
    "links",
    "Links",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("links", "pageId", 255, true);
  await createStringAttribute("links", "type", 64, true);
  await createStringAttribute("links", "title", 255, true);
  await createStringAttribute("links", "url", 4096, true);
  await createStringAttribute("links", "description", 4096, false);
  await createStringAttribute("links", "icon", 255, false);
  await createStringAttribute("links", "color", 32, false);
  await createStringAttribute("links", "imageId", 255, false);
  await createStringAttribute("links", "animation", 32, false, "none");
  await createBooleanAttribute("links", "active", true, true);
  await createBooleanAttribute("links", "visible", true, true);
  await createBooleanAttribute("links", "newTab", true, true);
  await createIntegerAttribute("links", "order", true, 0);
  await createIntegerAttribute("links", "clicks", true, 0);
  await createDatetimeAttribute("links", "scheduledFor", false);
  await waitForAttributes("links", [
    "pageId", "type", "title", "url", "description", "icon", "color", "imageId",
    "animation", "active", "visible", "newTab", "order", "clicks", "scheduledFor",
  ]);
  await createIndex("links", "idx_links_pageId", "key", ["pageId"]);
  await createIndex("links", "idx_links_pageId_order", "key", ["pageId", "order"]);

  // 5. Analytics collection
  // Sessão 36: só create. Analytics são privadas — só o dono lê as suas via
  // permissões por documento; as atualizações de contagem são server-side.
  console.log("\n📊 Collection: analytics");
  await createCollection(
    "analytics",
    "Analytics",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("analytics", "pageId", 255, true);
  await createIntegerAttribute("analytics", "views", true, 0);
  await createIntegerAttribute("analytics", "clicks", true, 0);
  await createIntegerAttribute("analytics", "followers", true, 0);
  await createStringAttribute("analytics", "metricsJson", 1048576, false);
  await waitForAttributes("analytics", ["pageId", "views", "clicks", "followers", "metricsJson"]);
  await createIndex("analytics", "idx_analytics_pageId", "unique", ["pageId"]);

  // 5b. Visits collection (raw analytics events)
  // Server-only: raw visits stored by the view/click API routes. The IP is
  // never exposed to clients — it is only used to derive the country and to
  // deduplicate unique visitors. No permissions: only the server SDK (API
  // key) writes/reads this collection; clients have zero access.
  console.log("\n🕵️ Collection: visits");
  await createCollection(
    "visits",
    "Visits",
    [],
    true
  );
  await createStringAttribute("visits", "pageId", 255, true);
  await createStringAttribute("visits", "visitorHash", 128, false);
  await createStringAttribute("visits", "ip", 64, false);
  await createStringAttribute("visits", "country", 128, false);
  await createStringAttribute("visits", "countryCode", 8, false);
  await createStringAttribute("visits", "city", 128, false);
  await createStringAttribute("visits", "device", 32, false);
  await createStringAttribute("visits", "browser", 64, false);
  await createStringAttribute("visits", "os", 64, false);
  await createStringAttribute("visits", "referer", 512, false);
  await createStringAttribute("visits", "userAgent", 512, false);
  await createStringAttribute("visits", "clickedLink", 255, false);
  await createDatetimeAttribute("visits", "createdAt", false);
  await waitForAttributes("visits", [
    "pageId", "visitorHash", "ip", "country", "countryCode", "city", "device",
    "browser", "os", "referer", "userAgent", "clickedLink", "createdAt",
  ]);
  await createIndex("visits", "idx_visits_pageId", "key", ["pageId"]);
  await createIndex("visits", "idx_visits_pageId_createdAt", "key", ["pageId", "createdAt"]);

  // 5c. Collected IPs collection (deduplicação de IPs — server-only)
  // Cada IP é recolhido NO MÁXIMO UMA VEZ: o índice único em `ip` garante
  // que o SaaS nunca grava o mesmo IP duas vezes. Se o registo for APAGADO
  // da base de dados, o próximo acesso volta a recolher o IP + país
  // (a chave única fica livre para ser reutilizada). Sem permissões:
  // só o SDK do servidor (API key) escreve/lê esta coleção.
  console.log("\n🛡️ Collection: collected_ips");
  await createCollection(
    "collected_ips",
    "Collected IPs",
    [],
    true
  );
  await createStringAttribute("collected_ips", "ip", 64, true);
  await createStringAttribute("collected_ips", "visitorHash", 128, false);
  await createStringAttribute("collected_ips", "country", 128, false);
  await createStringAttribute("collected_ips", "countryCode", 8, false);
  await createStringAttribute("collected_ips", "city", 128, false);
  await createStringAttribute("collected_ips", "device", 32, false);
  await createStringAttribute("collected_ips", "browser", 64, false);
  await createStringAttribute("collected_ips", "os", 64, false);
  await createDatetimeAttribute("collected_ips", "firstSeenAt", true);
  await createDatetimeAttribute("collected_ips", "lastSeenAt", false);
  await waitForAttributes("collected_ips", [
    "ip", "visitorHash", "country", "countryCode", "city", "device",
    "browser", "os", "firstSeenAt", "lastSeenAt",
  ]);
  // M6 (privacidade): o IP cru NUNCA é persistido — apenas hashIp(ip) é
  // gravado no campo `ip` e em `visitorHash`. O índice único em `ip` (hash)
  // garante "1 registo por IP" (mesmo IP → mesmo hash → 409); o índice único
  // em visitorHash cobre a query de dedup por hash.
  await createIndex("collected_ips", "idx_collected_ips_ip", "unique", ["ip"]);
  await createIndex("collected_ips", "idx_collected_ips_visitorHash", "unique", ["visitorHash"]);

  // 6. Themes collection
  // Sessão 36: só create ao nível da coleção; acesso por documento (dono).
  console.log("\n🎨 Collection: themes");
  await createCollection(
    "themes",
    "Themes",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("themes", "pageId", 255, true);
  // theme: OBRIGATÓRIO + default é impossível no Appwrite ("Cannot set
  // default value for required attribute"). Como o campo é legado (Liquid
  // Glass only), tornamos OPcional com default "glass": documentos criados
  // sem theme obtêm automaticamente "glass" e o createPage envia-o sempre
  // explicitamente (Sessão 30) — defesa em profundidade.
  await createStringAttribute("themes", "theme", 64, false, "glass");
  await createIntegerAttribute("themes", "blur", true, 25);
  await createIntegerAttribute("themes", "rounded", true, 16);
  await createIntegerAttribute("themes", "linkOpacity", true, 100);
  await createStringAttribute("themes", "backgroundColor", 32, false, "#0a0a0a");
  await createStringAttribute("themes", "cardColor", 32, false, "rgba(255,255,255,0.03)");
  await createStringAttribute("themes", "textColor", 32, false, "#fafafa");
  await createStringAttribute("themes", "accentColor", 32, false, "#fafafa");
  await createStringAttribute("themes", "fontFamily", 64, false, "Inter");
  await createIntegerAttribute("themes", "fontSize", true, 16);
  await createIntegerAttribute("themes", "buttonRadius", true, 12);
  await createStringAttribute("themes", "buttonWidth", 32, false, "full");
  await createStringAttribute("themes", "buttonHeight", 32, false, "normal");
  await createStringAttribute("themes", "buttonStyle", 32, false, "glass");
  await createStringAttribute("themes", "shadow", 32, false, "md");
  await createBooleanAttribute("themes", "showAvatar", true, true);
  await createBooleanAttribute("themes", "showBio", true, true);
  await createBooleanAttribute("themes", "showSocial", true, true);
  await createIntegerAttribute("themes", "spacing", true, 6);
  await waitForAttributes("themes", [
    "pageId", "theme", "blur", "rounded", "linkOpacity", "backgroundColor", "cardColor",
    "textColor", "accentColor", "fontFamily", "fontSize", "buttonRadius", "buttonWidth",
    "buttonHeight", "buttonStyle", "shadow", "showAvatar", "showBio", "showSocial", "spacing",
  ]);
  // Backfill: contas existentes têm themes.theme com default:null. Garante
  // required=false + default="glass" para o createDocument sem theme não
  // falhar com "Missing required attribute theme".
  await ensureStringAttributeDefault("themes", "theme", false, "glass");
  await createIndex("themes", "idx_themes_pageId", "unique", ["pageId"]);

  // 7. QR Codes collection
  // Sessão 36: só create; acesso por documento (dono).
  console.log("\n🔳 Collection: qr_codes");
  await createCollection(
    "qr_codes",
    "QR Codes",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("qr_codes", "pageId", 255, true);
  await createStringAttribute("qr_codes", "fgColor", 32, true, "#000000");
  await createStringAttribute("qr_codes", "bgColor", 32, true, "#FFFFFF");
  await createStringAttribute("qr_codes", "logoId", 255, false);
  await createIntegerAttribute("qr_codes", "size", true, 512);
  await waitForAttributes("qr_codes", ["pageId", "fgColor", "bgColor", "logoId", "size"]);
  await createIndex("qr_codes", "idx_qr_codes_pageId", "unique", ["pageId"]);

  // 9. Subscriptions collection
  // Sessão 36: só create; escrita/leitura feita server-side (Stripe webhooks).
  console.log("\n💳 Collection: subscriptions");
  await createCollection(
    "subscriptions",
    "Subscriptions",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("subscriptions", "userId", 255, true);
  await createStringAttribute("subscriptions", "stripeCustomerId", 255, false);
  await createStringAttribute("subscriptions", "status", 64, true, "active");
  await createStringAttribute("subscriptions", "plan", 32, true, "free");
  await createDatetimeAttribute("subscriptions", "currentPeriodEnd", false);
  await waitForAttributes("subscriptions", ["userId", "stripeCustomerId", "status", "plan", "currentPeriodEnd"]);
  await createIndex("subscriptions", "idx_subscriptions_userId", "key", ["userId"]);

  // 10. Teams collection
  // Sessão 36: só create; acesso por documento (dono).
  console.log("\n👥 Collection: teams");
  await createCollection(
    "teams",
    "Teams",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("teams", "name", 255, true);
  await createStringAttribute("teams", "ownerId", 255, true);
  await waitForAttributes("teams", ["name", "ownerId"]);
  await createIndex("teams", "idx_teams_ownerId", "key", ["ownerId"]);

  // 11. Notifications collection
  // Sessão 36: só create; acesso por documento (dono).
  console.log("\n🔔 Collection: notifications");
  await createCollection(
    "notifications",
    "Notifications",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("notifications", "userId", 255, true);
  await createStringAttribute("notifications", "type", 64, true);
  await createStringAttribute("notifications", "message", 4096, true);
  await createBooleanAttribute("notifications", "read", true, false);
  await createDatetimeAttribute("notifications", "createdAt", true);
  await waitForAttributes("notifications", ["userId", "type", "message", "read", "createdAt"]);
  await createIndex("notifications", "idx_notifications_userId", "key", ["userId"]);
  await createIndex("notifications", "idx_notifications_userId_read", "key", ["userId", "read"]);

  // 12. Security Logs collection
  // Sessão 36 (least-privilege): SEM permissões ao nível da coleção — server
  // only. A escrita e a leitura são feitas exclusivamente por rotas API
  // server-side (server SDK/API key) que derivam o userId da sessão e
  // validam a propriedade. Antes tinha read/update: users() — qualquer
  // utilizador autenticado lia/alterava os logs (emails + IPs) de todos.
  console.log("\n📋 Collection: security_logs");
  await createCollection(
    "security_logs",
    "Security Logs",
    [],
    true
  );
  await createStringAttribute("security_logs", "userId", 255, true);
  await createStringAttribute("security_logs", "eventType", 64, true);
  await createStringAttribute("security_logs", "email", 255, false);
  await createStringAttribute("security_logs", "ipAddress", 64, false);
  await createStringAttribute("security_logs", "userAgent", 512, false);
  await createStringAttribute("security_logs", "metadata", 4096, false);
  await createDatetimeAttribute("security_logs", "createdAt", true);
  await waitForAttributes("security_logs", ["userId", "eventType", "email", "ipAddress", "userAgent", "metadata", "createdAt"]);
  await createIndex("security_logs", "idx_security_userId", "key", ["userId"]);
  await createIndex("security_logs", "idx_security_eventType", "key", ["eventType"]);
  await createIndex("security_logs", "idx_security_createdAt", "key", ["createdAt"]);

  // 12b. Activity Logs collection (atividades recentes da conta)
  // Sessão 36: só create; o client SDK grava com permissões por documento
  // (Role.user) e só o dono lê o seu registo.
  console.log("\n📝 Collection: activity_logs");
  await createCollection(
    "activity_logs",
    "Activity Logs",
    [
      Permission.create(Role.users()),
    ],
    true
  );
  await createStringAttribute("activity_logs", "userId", 255, true);
  await createStringAttribute("activity_logs", "action", 64, true);
  await createStringAttribute("activity_logs", "details", 2048, false);
  await createStringAttribute("activity_logs", "ipAddress", 64, false);
  await createStringAttribute("activity_logs", "userAgent", 512, false);
  await createDatetimeAttribute("activity_logs", "createdAt", true);
  await waitForAttributes("activity_logs", [
    "userId", "action", "details", "ipAddress", "userAgent", "createdAt",
  ]);
  await createIndex("activity_logs", "idx_activity_userId", "key", ["userId"]);
  await createIndex("activity_logs", "idx_activity_userId_createdAt", "key", ["userId", "createdAt"]);

  // 12c. Staff applications collection (candidaturas ao staff)
  // Segurança: nenhuma permissão client-side. A candidatura é criada e
  // aprovada exclusivamente por rotas/server SDK com dados derivados da
  // sessão e com status controlado pelo servidor. O utilizador só recebe
  // Permission.read por documento na rota POST /api/staff/apply.
  console.log("\n🛠️ Collection: staff_applications");
  await createCollection(
    "staff_applications",
    "Staff Applications",
    [],
    true
  );
  await createStringAttribute("staff_applications", "userId", 255, true);
  await createStringAttribute("staff_applications", "message", 4096, true);
  await createStringAttribute("staff_applications", "status", 32, true, "pending");
  // Identifica a revisão confiável da equipa. Uma candidatura só pode
  // desbloquear a badge staff quando status=approved E reviewedBy preenchido.
  await createStringAttribute("staff_applications", "reviewedBy", 255, false, "");
  await createDatetimeAttribute("staff_applications", "createdAt", true);
  await waitForAttributes("staff_applications", ["userId", "message", "status", "reviewedBy", "createdAt"]);
  await createIndex("staff_applications", "idx_staff_userId", "key", ["userId"]);
  await createIndex("staff_applications", "idx_staff_userId_status", "key", ["userId", "status"]);

  // 13. Storage bucket (single bucket for all files to fit free plan)
  // Public read (Role.any()) so avatars/banners/images are visible on the
  // public page without authentication. Sessão 36: o bucket só tem
  // read(any)+create(users) — SEM update/delete users() (qualquer utilizador
  // podia apagar/substituir ficheiros de terceiros). O update/delete é
  // concedido por ficheiro (Role.user(owner)), definido no uploadFile do
  // client SDK.
  console.log("\n🗂️  Buckets");
  await ensureBucketWithPublicRead(storage, "files", "Files");
  console.log(
    "   ↳ NOTA: ficheiros já existentes no bucket só são re-scoped para permissões por dono com `npm run fix:bucket` (este script não tem acesso às databases para derivar os donos)."
  );

  console.log("\n✅ LinkFlow backend provisioned successfully!");
}

provision().catch((error) => {
  console.error("\n Provisioning failed:", error.message);
  process.exit(1);
});
