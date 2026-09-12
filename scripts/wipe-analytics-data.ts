/**
 * wipe-analytics-data.ts
 *
 * Deletes ALL documents from analytics-related collections to start fresh:
 *   - analytics (resets counters to 0, clears metricasJson)
 *   - visits (raw visit log)
 *   - ip_collection (IP data)
 *   - dados_para_estudos (study data)
 *
 * ⚠️  DESTRUTIVO E IRREVERSÍVEL — apaga dados GLOBAIS (de todos os utilizadores),
 *     não apenas os de uma página. Corre primeiro o modo de leitura:
 *
 *   npx tsx --env-file=.env.local scripts/wipe-analytics-data.ts
 *
 * Para escrever de facto são precisos DOIS argumentos:
 *
 *   npx tsx --env-file=.env.local scripts/wipe-analytics-data.ts \
 *     --yes --confirm=linkflow
 *
 * `--confirm=<base de dados>` tem de corresponder ao databaseId configurado:
 * obriga a escrever o alvo à mão, para que um `--yes` a mais (ou o histórico
 * do shell) não possa limpar a base de dados de produção por engano.
 */
import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const args = process.argv.slice(2);
const CONFIRM = args.includes("--yes");
const confirmTarget = args.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length) ?? "";

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
  process.env.APPWRITE_ENDPOINT ??
  "https://fra.cloud.appwrite.io/v1";
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ??
  process.env.APPWRITE_DATABASE_ID ??
  "linkflow";

if (!projectId || !apiKey) {
  console.error("Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const COLLECTIONS_TO_WIPE = ["visits", "ip_collection", "dados_para_estudos"] as const;
const COLLECTIONS_TO_RESET = ["analytics"] as const;

const EMPTY_METRICS = JSON.stringify({
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

async function deleteAllDocuments(collectionId: string): Promise<number> {
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    const docs = await databases.listDocuments(databaseId, collectionId, [
      Query.limit(100),
    ]);

    if (docs.documents.length === 0) {
      hasMore = false;
      break;
    }

    const results = await Promise.allSettled(
      docs.documents.map((doc) =>
        databases.deleteDocument(databaseId, collectionId, doc.$id)
      )
    );

    const deleted = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    total += deleted;

    if (failed > 0) {
      console.warn(
        `  ⚠ ${failed}/${docs.documents.length} deletes failed in batch`
      );
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  return total;
}

async function resetAnalyticsDocuments(): Promise<number> {
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    const docs = await databases.listDocuments(databaseId, "analytics", [
      Query.limit(100),
    ]);

    if (docs.documents.length === 0) {
      hasMore = false;
      break;
    }

    const results = await Promise.allSettled(
      docs.documents.map((doc) =>
        databases.updateDocument(databaseId, "analytics", doc.$id, {
          visualizacoes: 0,
          cliques: 0,
          seguidores: 0,
          metricasJson: EMPTY_METRICS,
        })
      )
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    total += ok;

    if (failed > 0) {
      console.warn(
        `  ⚠ ${failed}/${docs.documents.length} resets failed in batch`
      );
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return total;
}

async function main() {
  console.log("🔗 Connecting to Appwrite:", endpoint, "/ project:", projectId);
  console.log("🗄  Database:", databaseId);
  console.log();

  // Duas barreiras: o alvo escrito à mão e o `--yes`. Sem ambas, o script só
  // relata o que faria — nunca toca em dados.
  if (!CONFIRM || confirmTarget !== databaseId) {
    console.log("DRY RUN — nada foi apagado.");
    console.log(`  Coleções a esvaziar: ${COLLECTIONS_TO_WIPE.join(", ")}`);
    console.log(`  Coleções a repor a zero: ${COLLECTIONS_TO_RESET.join(", ")}`);
    console.log();
    console.log("⚠️  Isto afeta TODOS os utilizadores, é irreversível, e não distingue");
    console.log("    produção de desenvolvimento — a base de dados é a que está em .env.local.");
    console.log();
    console.log("Para apagar de facto:");
    console.log(`  npx tsx --env-file=.env.local scripts/wipe-analytics-data.ts --yes --confirm=${databaseId}`);
    process.exit(0);
  }

  console.log(`🔥 MODO DESTRUTIVO confirmado para a base de dados "${databaseId}".`);
  console.log();

  // Wipe collections entirely
  for (const col of COLLECTIONS_TO_WIPE) {
    process.stdout.write(`🗑  Deleting all documents from "${col}"... `);
    try {
      const count = await deleteAllDocuments(col);
      console.log(`done (${count} deleted)`);
    } catch (error) {
      console.error(`FAILED:`, error);
    }
  }

  console.log();

  // Reset analytics to zero
  for (const col of COLLECTIONS_TO_RESET) {
    process.stdout.write(`🔄 Resetting all documents in "${col}" to zero... `);
    try {
      const count = await resetAnalyticsDocuments();
      console.log(`done (${count} reset)`);
    } catch (error) {
      console.error(`FAILED:`, error);
    }
  }

  console.log();
  console.log("✅ All analytics data wiped. Dashboard will show 0 from now on.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
