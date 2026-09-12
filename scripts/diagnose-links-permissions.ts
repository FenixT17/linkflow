/**
 * Diagnóstico READ-ONLY: por que os links existem na BD mas não aparecem
 * para o dono na interface.
 *
 * Hipótese testada: os documentos não concedem leitura ao dono
 * (`Permission.read(Role.user(<idUtilizador>))`), pelo que:
 *  - `listDocuments` (usado pelo browser) devolve a lista FILTRADA por
 *    permissões → a UI mostra 0 links;
 *  - o `total` da mesma query continua a contar os documentos → o proxy
 *    `/api/appwrite` aplica o limite do plano gratuito e recusa criar novos.
 *
 * Este script usa a API key (ignora permissões), por isso vê tudo.
 * Não escreve nada.
 *
 * Uso: npx tsx scripts/diagnose-links-permissions.ts
 */
import { Client, Databases, Query, Storage } from "node-appwrite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "linkflow";

if (!projectId || !apiKey) {
  console.error("Faltam NEXT_PUBLIC_APPWRITE_PROJECT_ID ou APPWRITE_API_KEY no .env.local");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

type Doc = Record<string, unknown> & { $id: string; $permissions: string[] };

const PAGE_SIZE = 100;

async function listAll(collectionId: string, queries: string[] = []): Promise<Doc[]> {
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

function hasOwnerRead(permissions: string[], ownerId: string): boolean {
  return permissions.includes(`read("user:${ownerId}")`) || permissions.includes("read(\"any\")");
}

function short(perms: string[]): string {
  if (perms.length === 0) return "[] (VAZIO)";
  return perms.join(" ");
}

async function main() {
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Database: ${databaseId}\n`);

  const pages = await listAll("pages");
  console.log(`===== PAGES (${pages.length}) =====`);
  const pageById = new Map<string, Doc>();
  const pagesByUser = new Map<string, Doc[]>();
  for (const page of pages) {
    pageById.set(page.$id, page);
    const ownerId = String(page.idUtilizador ?? "");
    pagesByUser.set(ownerId, [...(pagesByUser.get(ownerId) ?? []), page]);
    console.log(
      `  $id=${page.$id} user=${ownerId} @${page.nomeUtilizador} publicado=${page.publicado} ` +
        `eliminar=${page.aEliminar ?? false} perms=[${short(page.$permissions)}]`,
    );
  }

  const duplicated = [...pagesByUser.entries()].filter(([, list]) => list.length > 1);
  if (duplicated.length > 0) {
    console.log(`\n  ⚠ ${duplicated.length} utilizador(es) com MAIS DE UMA página:`);
    for (const [userId, list] of duplicated) {
      console.log(`    user=${userId} -> ${list.map((p) => p.$id).join(", ")}`);
    }
  }

  const links = await listAll("links");
  console.log(`\n===== LINKS (${links.length}) =====`);
  const linksByPage = new Map<string, Doc[]>();
  for (const link of links) {
    const pid = String(link.idPagina ?? "");
    linksByPage.set(pid, [...(linksByPage.get(pid) ?? []), link]);
  }

  for (const [pid, list] of linksByPage) {
    const page = pageById.get(pid);
    const ownerId = page ? String(page.idUtilizador ?? "") : "";
    const readable = list.filter((l) => hasOwnerRead(l.$permissions, ownerId)).length;
    console.log(
      `\n  página ${pid}${page ? ` (@${page.nomeUtilizador}, user=${ownerId})` : " <<< PÁGINA INEXISTENTE"}` +
        ` -> ${list.length} link(s), ${readable} legível(is) pelo dono`,
    );
    if (readable < list.length) {
      console.log(`    🔴 ${list.length - readable} link(s) SEM permissão de leitura para o dono:`);
    }
    for (const link of list) {
      const flag = hasOwnerRead(link.$permissions, ownerId) ? "  ok " : " 🔴 ";
      console.log(
        `${flag}$id=${link.$id} ordem=${link.ordem} ativo=${link.ativo} visivel=${link.visivel} ` +
          `titulo="${link.titulo}" perms=[${short(link.$permissions)}]`,
      );
    }
  }

  const orphanLinks = [...linksByPage.keys()].filter((pid) => !pageById.has(pid));
  if (orphanLinks.length > 0) {
    console.log(`\n  ⚠ links apontam para páginas inexistentes: ${orphanLinks.join(", ")}`);
  }

  const analytics = await listAll("analytics");
  console.log(`\n===== ANALYTICS (${analytics.length}) =====`);
  for (const doc of analytics) {
    const page = pageById.get(String(doc.idPagina ?? ""));
    const ownerId = page ? String(page.idUtilizador ?? "") : "";
    const metrics = (() => {
      try {
        return JSON.parse(String(doc.metricasJson ?? "{}")) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
    const flag = page && hasOwnerRead(doc.$permissions, ownerId) ? "  ok " : " 🔴 ";
    console.log(
      `${flag}página=${doc.idPagina} views=${doc.visualizacoes} cliques=${doc.cliques} ` +
        `uniqueVisitors=${metrics.uniqueVisitors ?? 0} ` +
        `dailyStats=${Array.isArray(metrics.dailyStats) ? metrics.dailyStats.length : 0} ` +
        `dailyVisitors=${Array.isArray(metrics.dailyVisitors) ? metrics.dailyVisitors.length : 0} ` +
        `perms=[${short(doc.$permissions)}]`,
    );
  }

  const analyticsPageIds = new Set(analytics.map((a) => String(a.idPagina ?? "")));
  const missing = pages.filter((p) => !analyticsPageIds.has(p.$id));
  if (missing.length > 0) {
    console.log(`\n  ⚠ páginas sem documento de analytics (${missing.length}):`);
    for (const p of missing) console.log(`    ${p.$id} (@${p.nomeUtilizador})`);
  }

  const [visits, collectedIps, study] = await Promise.all([
    databases.listDocuments(databaseId, "visits", [Query.limit(1)]).then((r) => r.total).catch(() => "n/d"),
    databases.listDocuments(databaseId, "collected_ips", [Query.limit(1)]).then((r) => r.total).catch(() => "n/d"),
    databases.listDocuments(databaseId, "dados_para_estudos", [Query.limit(1)]).then((r) => r.total).catch(() => "n/d"),
  ]);
  console.log(`\n===== COLETA =====`);
  console.log(`  visits=${visits}  collected_ips=${collectedIps}  dados_para_estudos=${study}`);

  const bucketId = process.env.NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID ?? "files";
  const files = await storage.listFiles(bucketId, [Query.limit(1)]).then((r) => r.total).catch(() => "n/d");
  console.log(`  ficheiros no bucket ${bucketId}=${files}`);
}

main().catch((error) => {
  console.error("Diagnóstico falhou:", error);
  process.exit(1);
});
