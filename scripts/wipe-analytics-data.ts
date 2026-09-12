/**
 * wipe-analytics-data.ts
 *
 * Deletes ALL documents from analytics-related collections to start fresh:
 *   - analytics (resets counters to 0, clears metricasJson)
 *   - visits (raw visit log)
 *   - ip_collection (IP data)
 *   - dados_para_estudos (study data)
 *
 * Usage: npx tsx scripts/wipe-analytics-data.ts
 */
import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

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
