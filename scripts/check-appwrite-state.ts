import { Client, Databases, Query } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "linkflow";
const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
async function check() {
  const pages = await databases.listDocuments(databaseId, "pages", [Query.limit(20)]);
  const analytics = await databases.listDocuments(databaseId, "analytics", [Query.limit(20)]);
  const analyticsPageIds = new Set(analytics.documents.map(a => a.idPagina));
  console.log("Pages without analytics doc:");
  for (const p of pages.documents) {
    if (!analyticsPageIds.has(p.$id)) {
      console.log("  " + p.$id + " publicado=" + p.publicado + " user=" + p.idUtilizador);
    }
  }
  const links = await databases.listDocuments(databaseId, "links", [Query.limit(50)]);
  const pagesWithLinks = new Set(links.documents.map(l => l.idPagina));
  console.log("\nPages with links:", [...pagesWithLinks]);
  for (const pid of pagesWithLinks) {
    const count = links.documents.filter(l => l.idPagina === pid).length;
    console.log("  " + pid + ": " + count + " links");
  }
  // Check analytics metricasJson content
  console.log("\nAnalytics metricasJson samples:");
  for (const a of analytics.documents) {
    const metrics = JSON.parse(String(a.metricasJson || "{}"));
    const dailyStats = Array.isArray(metrics.dailyStats) ? metrics.dailyStats.length : 0;
    const topLinks = Array.isArray(metrics.topLinks) ? metrics.topLinks.length : 0;
    const recentVisitors = Array.isArray(metrics.recentVisitors) ? metrics.recentVisitors.length : 0;
    console.log("  " + a.idPagina + " dailyStats=" + dailyStats + " topLinks=" + topLinks + " recentVisitors=" + recentVisitors + " views=" + a.visualizacoes + " clicks=" + a.cliques);
  }
}
check();
