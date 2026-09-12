/**
 * cleanup-test-pages.ts
 *
 * Remove páginas de TESTE criadas por engano (nomes de utilizador gerados
 * automaticamente por idempotência/verificações, ex: `idemmtxjtvha`,
 * `criatstmtxm82ht`) e TODOS os documentos associados.
 *
 * Porque existe: estes registos não são contas reais — são o resultado de
 * pedidos duplicados ou de testes manuais, e ficaram a ocupar nomes de
 * utilizador (o índice único em `nomeUtilizador` impede que alguém os use).
 *
 * SEGURANÇA
 * - Corre em DRY READ por omissão: só lista o que apagaria. Nada é escrito.
 * - Para apagar de facto é preciso `--yes` (evita um toque acidental).
 * - Os nomes são apanhados por um padrão conservador (prefixos de teste +
 *   sufixo base36). Nomes reais como `admin`, `admin0748`, `eltutor` ou
 *   `ghostbyte` NÃO correspondem — nunca são tocados.
 * - `--user=<nome>` força a inclusão (ou exclusão) explícita de um nome.
 * - `--with-users` apaga também a conta de autenticação Appwrite (sem isto,
 *   a conta fica órfã e o nome de utilizador continua ocupado).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/cleanup-test-pages.ts
 *   npx tsx --env-file=.env.local scripts/cleanup-test-pages.ts --yes
 *   npx tsx --env-file=.env.local scripts/cleanup-test-pages.ts --yes --with-users
 */
import { Client, Databases, Query, Storage, Users } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? process.env.APPWRITE_DATABASE_ID ?? "linkflow";
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID ?? "files";

if (!projectId || !apiKey) {
  console.error("Faltam NEXT_PUBLIC_APPWRITE_PROJECT_ID ou APPWRITE_API_KEY no ambiente.");
  process.exit(1);
}

const args = process.argv.slice(2);
const CONFIRM = args.includes("--yes");
const WITH_USERS = args.includes("--with-users");
const FORCED = args
  .filter((a) => a.startsWith("--user="))
  .map((a) => a.slice("--user=".length).trim().toLowerCase())
  .filter(Boolean);

/**
 * Padrão conservador para nomes gerados automaticamente.
 * `idemmtxjtvha` / `criatstmtxm82ht` correspondem; `admin0748` não.
 */
const AUTO_GENERATED = /^(?:idem|seed|test|tmp|e2e|criat)[a-z0-9]{6,}$/;

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);
const users = new Users(client);

type Doc = Record<string, unknown> & { $id: string };

const PAGE_SIZE = 100;

/** Coleções filtradas por `idPagina`. */
const PAGE_SCOPED = ["links", "analytics", "visits", "themes", "qr_codes", "dados_para_estudos"];
/** Coleções filtradas por `idUtilizador`. */
const USER_SCOPED = [
  "activity_logs",
  "security_logs",
  "notifications",
  "subscriptions",
  "staff_applications",
];

async function listAll(collectionId: string, queries: string[]): Promise<Doc[]> {
  const out: Doc[] = [];
  let offset = 0;
  for (;;) {
    const res = await databases.listDocuments(databaseId, collectionId, [
      ...queries,
      Query.limit(PAGE_SIZE),
      Query.offset(offset),
    ]);
    const batch = res.documents as unknown as Doc[];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += batch.length;
  }
  return out;
}

async function count(collectionId: string, queries: string[]): Promise<number | string> {
  try {
    const res = await databases.listDocuments(databaseId, collectionId, [
      ...queries,
      Query.limit(1),
    ]);
    return res.total;
  } catch {
    return "n/d";
  }
}

async function deleteByIds(collectionId: string, docs: Doc[]): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const doc of docs) {
    try {
      await databases.deleteDocument(databaseId, collectionId, doc.$id);
      ok += 1;
    } catch (error) {
      failed += 1;
      console.warn(`    ✗ ${collectionId}/${doc.$id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return { ok, failed };
}

async function main() {
  console.log(`${CONFIRM ? "🔥 MODO DE ESCRITA" : "🔍 DRY RUN (nada será apagado)"}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Database: ${databaseId}\n`);

  const pages = await listAll("pages", []);
  const targets = pages.filter((page) => {
    const name = String(page.nomeUtilizador ?? "").toLowerCase();
    return AUTO_GENERATED.test(name) || FORCED.includes(name);
  });

  if (targets.length === 0) {
    console.log("Nenhuma página de teste encontrada. Nada a fazer.");
    return;
  }

  console.log(`===== PÁGINAS DE TESTE (${targets.length}) =====`);
  for (const page of targets) {
    console.log(
      `  $id=${page.$id} @${page.nomeUtilizador} user=${String(page.idUtilizador ?? "")} ` +
        `publicado=${page.publicado} criada=${String(page.$createdAt ?? "")}`,
    );
  }

  console.log("\n===== DADOS ASSOCIADOS =====");
  type Plan = { collectionId: string; queries: string[]; docs: Doc[]; total: number | string };
  const plan: Plan[] = [];

  for (const page of targets) {
    const pageId = page.$id;
    const ownerId = String(page.idUtilizador ?? "");
    const scope: { collectionId: string; queries: string[] }[] = [
      ...PAGE_SCOPED.map((collectionId) => ({
        collectionId,
        queries: [Query.equal("idPagina", pageId)],
      })),
      ...USER_SCOPED.map((collectionId) => ({
        collectionId,
        queries: [Query.equal("idUtilizador", ownerId)],
      })),
      { collectionId: "users", queries: [Query.equal("idUtilizador", ownerId)] },
    ];

    console.log(`\n  @${page.nomeUtilizador} (${pageId}):`);
    for (const { collectionId, queries } of scope) {
      const total = await count(collectionId, queries);
      let docs: Doc[] = [];
      if (CONFIRM && typeof total === "number" && total > 0) {
        docs = await listAll(collectionId, queries);
      }
      console.log(`    ${collectionId}: ${total} documento(s)`);
      if (typeof total === "number" && total > 0) plan.push({ collectionId, queries, docs, total });
    }
  }

  if (!CONFIRM) {
    console.log(
      "\n(dry run) Corre novamente com --yes para apagar o que está listado acima.",
    );
    return;
  }

  console.log("\n===== A APAGAR =====");
  const byCollection = new Map<string, Doc[]>();
  for (const entry of plan) {
    byCollection.set(entry.collectionId, [
      ...(byCollection.get(entry.collectionId) ?? []),
      ...entry.docs,
    ]);
  }
  for (const [collectionId, docs] of byCollection) {
    const { ok, failed } = await deleteByIds(collectionId, docs);
    console.log(`  ${collectionId}: ${ok} apagado(s)${failed > 0 ? `, ${failed} falha(s)` : ""}`);
  }

  // Ficheiros de avatar/banner das páginas.
  let filesDeleted = 0;
  for (const page of targets) {
    for (const field of ["idAvatar", "idBanner"] as const) {
      const fileId = String(page[field] ?? "");
      if (!fileId) continue;
      try {
        await storage.deleteFile(bucketId, fileId);
        filesDeleted += 1;
      } catch (error) {
        console.warn(`    ✗ ficheiro ${fileId}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  console.log(`  bucket ${bucketId}: ${filesDeleted} ficheiro(s) apagado(s)`);

  // Páginas por último (depois de os filhos desaparecerem).
  const pageDocs = targets.map((page) => ({ $id: page.$id }) as Doc);
  const { ok, failed } = await deleteByIds("pages", pageDocs);
  console.log(`  pages: ${ok} apagada(s)${failed > 0 ? `, ${failed} falha(s)` : ""}`);

  // Contas de autenticação (opcional).
  const owners = [...new Set(targets.map((page) => String(page.idUtilizador ?? "")).filter(Boolean))];
  if (WITH_USERS) {
    console.log("\n===== CONTAS DE AUTENTICAÇÃO =====");
    for (const ownerId of owners) {
      try {
        const account = await users.get(ownerId);
        await users.delete(ownerId);
        console.log(`  ✓ ${account.email} (${ownerId}) apagada`);
      } catch (error) {
        console.warn(`  ✗ ${ownerId}: ${error instanceof Error ? error.message : error}`);
      }
    }
  } else {
    console.log(
      `\n⚠ As ${owners.length} contas de autenticação NÃO foram apagadas (usa --with-users). ` +
        `Ficam órfãs e continuam a ocupar os nomes de utilizador:\n  ${owners.join("\n  ")}`,
    );
  }

  console.log("\n✅ Concluído.");
}

main().catch((error) => {
  console.error("Falhou:", error);
  process.exit(1);
});
