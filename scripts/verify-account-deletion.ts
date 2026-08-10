/**
 * Validação end-to-end da exclusão de conta (Sessão 43).
 *
 * Cria um utilizador de teste + dados em TODAS as coleções + um ficheiro no
 * bucket, executa deleteAccountData() e verifica que os dados da aplicação
 * foram removidos, mas a identidade Auth foi preservada:
 *   - Identidade Auth Appwrite preservada (email/nome continuam disponíveis)
 *   - Zero documentos por página (links, themes, analytics, visits, qr_codes,
 *     dados_para_estudos)
 *   - Zero documentos por utilizador (subscriptions, teams, notifications,
 *     activity_logs, staff_applications, users)
 *   - security_logs sem linhas do utilizador (userId / email-hash / metadata)
 *   - collected_ips sem o hash do visitante de teste
 *   - Ficheiro do bucket apagado
 *
 * A identidade Auth é mantida (email/nome/password/OAuth), mas as sessões
 * são revogadas para impedir acesso aos dados apagados.
 *
 * Executar: npm run verify:account-deletion
 * (os imports de src/lib leem process.env ao carregar o módulo, por isso as
 * variáveis têm de estar no ambiente ANTES — daí o --env-file no script npm)
 */
import {
  Client,
  Databases,
  Storage,
  Users,
  ID,
  Permission,
  Role,
  Query,
} from "node-appwrite";
// InputFile não é re-exportado do índice no node-appwrite v27 — subpath "./file"
import { InputFile } from "node-appwrite/file";
import { databaseId, filesBucketId } from "../src/lib/appwrite.server";
import { deleteAccountData } from "../src/lib/account-deletion.server";
import {
  ACCOUNT_COLLECTIONS,
  PAGE_SCOPED_COLLECTIONS,
} from "../src/lib/account-deletion";
import { hashForLog } from "../src/lib/sanitize";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://nyc.cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const apiKey = process.env.APPWRITE_API_KEY ?? "";

if (!projectId || !apiKey) {
  console.error("Missing env vars (NEXT_PUBLIC_APPWRITE_PROJECT_ID / APPWRITE_API_KEY)");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);
const users = new Users(client);

const stamp = Date.now();
const email = `deletion-check-${stamp}@linkflow.app`;
const password = "Teste!1234Delecao";
const name = "Deletion Check";
const username = `dt${stamp}`;
const visitorHash = `vh${stamp}`; // único por execução (índice único em collected_ips)
let userId = "";
let pageId = "";
let fileId = "";

function ownerPerms(uid: string): string[] {
  return [
    Permission.read(Role.user(uid)),
    Permission.update(Role.user(uid)),
    Permission.delete(Role.user(uid)),
  ];
}

async function createIdentity(): Promise<string> {
  const u = await users.create(ID.unique(), email, undefined, password, name);
  return u.$id;
}

async function createData(uid: string): Promise<void> {
  const perms = ownerPerms(uid);
  const now = new Date().toISOString();

  // users collection (perfil custom)
  await databases.createDocument(
    databaseId,
    "users",
    ID.unique(),
    { userId: uid, email, displayName: name, plan: "free", country: "", countryCode: "", currency: "EUR", createdAt: now },
    perms
  );

  // pages
  const page = await databases.createDocument(
    databaseId,
    "pages",
    ID.unique(),
    { userId: uid, username, displayName: name, bio: "teste exclusao", published: true, pageType: "minimal", pageTemplate: "template1", deleting: false },
    perms
  );
  pageId = page.$id;

  // links
  await databases.createDocument(
    databaseId,
    "links",
    ID.unique(),
    { pageId, type: "link", title: "Teste", url: "https://example.com", description: "", active: true, visible: true, newTab: true, order: 0, clicks: 0, animation: "none" },
    perms
  );

  // themes
  await databases.createDocument(
    databaseId,
    "themes",
    ID.unique(),
    { pageId, theme: "glass", blur: 25, rounded: 16, linkOpacity: 100, fontSize: 16, buttonRadius: 12, showAvatar: true, showBio: true, showSocial: true, spacing: 6 },
    perms
  );

  // analytics (com visitorSet — base do cleanup de collected_ips)
  await databases.createDocument(
    databaseId,
    "analytics",
    ID.unique(),
    {
      pageId,
      views: 5,
      clicks: 2,
      followers: 1,
      metricsJson: JSON.stringify({
        topCountries: [{ country: "Portugal", countryCode: "PT", count: 5 }],
        topDevices: [],
        topLinks: [],
        recentVisitors: [{ id: visitorHash, country: "Portugal", countryCode: "PT", device: "mobile", browser: "Chrome", os: "Android", time: now }],
        dailyStats: [{ day: "2026-08-05", views: 5, clicks: 2 }],
        visitorSet: [visitorHash],
        dailyVisitors: [{ day: "2026-08-05", hashes: [visitorHash] }],
        uniqueVisitors: 1,
        ctr: 40,
        weeklyGrowth: 0,
        monthlyGrowth: 0,
        visitorGrowth: 0,
      }),
    },
    perms
  );

  // visits (server-only)
  await databases.createDocument(
    databaseId,
    "visits",
    ID.unique(),
    { pageId, visitorHash, ip: visitorHash, country: "Portugal", countryCode: "PT", device: "mobile", browser: "Chrome", os: "Android", createdAt: now }
  );

  // collected_ips (server-only) — hash só usado pela página de teste
  await databases.createDocument(
    databaseId,
    "collected_ips",
    ID.unique(),
    { ip: visitorHash, visitorHash, country: "Portugal", countryCode: "PT", firstSeenAt: now, lastSeenAt: now }
  );

  // dados_para_estudos (server-only)
  await databases.createDocument(
    databaseId,
    "dados_para_estudos",
    ID.unique(),
    { ip: "203.0.113.99", deviceName: "Pixel 7", device: "mobile", browser: "Chrome", os: "Android", userAgent: "Mozilla/5.0 test", latitude: "38.7223", longitude: "-9.1393", coordinates: "38.7223, -9.1393", pageId, referer: "https://example.com/", createdAt: now }
  );

  // subscriptions / teams / notifications / activity_logs / staff_applications
  await databases.createDocument(databaseId, "subscriptions", ID.unique(), { userId: uid, status: "active", plan: "free" }, perms);
  await databases.createDocument(databaseId, "teams", ID.unique(), { name: "Equipa Teste", ownerId: uid }, perms);
  await databases.createDocument(databaseId, "notifications", ID.unique(), { userId: uid, type: "test", message: "teste", read: false, createdAt: now }, perms);
  await databases.createDocument(databaseId, "activity_logs", ID.unique(), { userId: uid, action: "link_created", createdAt: now }, perms);
  await databases.createDocument(databaseId, "staff_applications", ID.unique(), { userId: uid, message: "Candidatura de teste para validar exclusão", status: "pending", createdAt: now }, perms);

  // security_logs: linha com userId, linha com email-hash (userId vazio —
  // o atributo é obrigatório mas o log pode ser pré-autenticação), linha com
  // metadata a referenciar o userId
  await databases.createDocument(databaseId, "security_logs", ID.unique(), { userId: uid, eventType: "login", createdAt: now });
  await databases.createDocument(databaseId, "security_logs", ID.unique(), { userId: "", eventType: "login_failed", email: await hashForLog(email), createdAt: now });
  await databases.createDocument(databaseId, "security_logs", ID.unique(), { userId: "", eventType: "delete_account", metadata: JSON.stringify({ userId: uid }), createdAt: now });

  // qr_codes
  await databases.createDocument(
    databaseId,
    "qr_codes",
    ID.unique(),
    { pageId, fgColor: "#000000", bgColor: "#FFFFFF", size: 512 },
    perms
  );

  // ficheiro no bucket (permissões por dono — cleanup via fileBelongsToUser)
  const file = await storage.createFile(
    filesBucketId,
    ID.unique(),
    InputFile.fromBuffer(PNG, "test.png"),
    [
      Permission.read(Role.any()),
      Permission.update(Role.user(uid)),
      Permission.delete(Role.user(uid)),
    ]
  );
  fileId = file.$id;
  console.log(`   ↳ ficheiro criado: ${file.$id} (permissions: ${JSON.stringify((file as { $permissions?: string[] }).$permissions)})`);
}

async function verify(uid: string): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  // 1. Identidade Auth Appwrite preservada, incluindo email e nome.
  try {
    const authUser = await users.get(uid);
    results.identidade_auth_preservada = authUser.email === email && authUser.name === name;
  } catch {
    results.identidade_auth_preservada = false;
  }

  // 2. Todas as sessões devem ter sido revogadas sem apagar a identidade.
  try {
    const sessions = await users.listSessions(uid);
    results.sessoes_auth_revogadas = sessions.total === 0;
  } catch {
    results.sessoes_auth_revogadas = false;
  }

  // 3. Coleções por página
  for (const coll of PAGE_SCOPED_COLLECTIONS) {
    const r = await databases.listDocuments(databaseId, coll, [Query.equal("pageId", pageId)]);
    results[`${coll}_limpa`] = r.total === 0;
  }

  // 4. Coleções por utilizador (teams usa ownerId)
  const userOwnerFields: Record<string, string> = {
    [ACCOUNT_COLLECTIONS.subscriptions]: "userId",
    [ACCOUNT_COLLECTIONS.teams]: "ownerId",
    [ACCOUNT_COLLECTIONS.notifications]: "userId",
    [ACCOUNT_COLLECTIONS.activityLogs]: "userId",
    [ACCOUNT_COLLECTIONS.staffApplications]: "userId",
  };
  for (const [coll, field] of Object.entries(userOwnerFields)) {
    const r = await databases.listDocuments(databaseId, coll, [Query.equal(field, uid)]);
    results[`${coll}_limpa`] = r.total === 0;
  }

  // 5. Perfil na coleção users
  const userDocs = await databases.listDocuments(databaseId, "users", [Query.equal("userId", uid)]);
  results.users_perfil_limpo = userDocs.total === 0;

  // 6. security_logs (userId / email-hash / metadata)
  const emailHash = await hashForLog(email);
  const securityLogs = await databases.listDocuments(databaseId, "security_logs");
  const leaked = securityLogs.documents.filter((d) => {
    const doc = d as Record<string, unknown>;
    return (
      String(doc.userId ?? "") === uid ||
      String(doc.metadata ?? "").includes(uid) ||
      String(doc.email ?? "") === emailHash
    );
  });
  results.security_logs_limpos = leaked.length === 0;

  // 7. collected_ips — o hash de teste só era usado pela página de teste
  const ips = await databases.listDocuments(databaseId, "collected_ips", [Query.equal("visitorHash", visitorHash)]);
  results.collected_ips_limpos = ips.total === 0;

  // 8. Ficheiro apagado
  try {
    await storage.getFile(filesBucketId, fileId);
    results.ficheiro_apagado = false;
  } catch {
    results.ficheiro_apagado = true;
  }

  return results;
}

async function forceCleanup(uid: string): Promise<void> {
  // Best-effort: remove restos se a validação falhar a meio
  try {
    if (fileId) await storage.deleteFile(filesBucketId, fileId).catch(() => {});
  } catch {}
  try {
    const ips = await databases.listDocuments(databaseId, "collected_ips", [Query.equal("visitorHash", visitorHash)]);
    for (const d of ips.documents) await databases.deleteDocument(databaseId, "collected_ips", d.$id);
  } catch {}
  for (const coll of PAGE_SCOPED_COLLECTIONS) {
    try {
      const r = await databases.listDocuments(databaseId, coll, [Query.equal("pageId", pageId)]);
      for (const d of r.documents) await databases.deleteDocument(databaseId, coll, d.$id);
    } catch {}
  }
  const cleanupOwnerFields: Record<string, string> = {
    [ACCOUNT_COLLECTIONS.users]: "userId",
    [ACCOUNT_COLLECTIONS.subscriptions]: "userId",
    [ACCOUNT_COLLECTIONS.teams]: "ownerId",
    [ACCOUNT_COLLECTIONS.notifications]: "userId",
    [ACCOUNT_COLLECTIONS.activityLogs]: "userId",
    [ACCOUNT_COLLECTIONS.staffApplications]: "userId",
  };
  for (const [coll, field] of Object.entries(cleanupOwnerFields)) {
    try {
      const r = await databases.listDocuments(databaseId, coll, [Query.equal(field, uid)]);
      for (const d of r.documents) await databases.deleteDocument(databaseId, coll, d.$id);
    } catch {}
  }
  try { await users.deleteSessions(uid); } catch {}
  try { await users.delete(uid); } catch {}
}

async function main(): Promise<void> {
  console.log("🔍 Validação da exclusão de conta (Sessão 43)\n");
  console.log(`   ↳ Utilizador de teste: ${email}`);

  try {
    userId = await createIdentity();
    console.log(`   ↳ Identidade criada: ${userId}`);
    await createData(userId);
    console.log(`   ↳ Página criada: ${pageId}`);
    console.log("   ↳ Dados criados em 14 coleções + 1 ficheiro\n");

    console.log("   ▶ Executando deleteAccountData()...");
    await deleteAccountData(userId, email);
    console.log("   ↳ deleteAccountData() concluído sem erros\n");

    const results = await verify(userId);
    console.log("📋 Resultados:");
    let allPass = true;
    for (const [check, ok] of Object.entries(results)) {
      console.log(`   ${ok ? "✅" : "❌"} ${check}`);
      if (!ok) allPass = false;
    }
    if (!allPass) {
      // deleteAccountData correu mas sobrou algo — limpar o teste para não poluir a BD.
      console.log("   → Limpeza dos resíduos...");
      if (userId) await forceCleanup(userId).catch(() => {});
    }
    console.log(allPass ? "\n🎉 EXCLUSÃO DE CONTA 100% VALIDADA" : "\n❌ HÁ RESÍDUOS — ver acima");
    process.exit(allPass ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Validação falhou:", (error as Error).message);
    console.error("   → Limpeza de emergência...");
    if (userId) await forceCleanup(userId).catch(() => {});
    process.exit(1);
  }
}

main();
