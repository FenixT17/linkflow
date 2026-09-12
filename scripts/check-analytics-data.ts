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
  for (const col of ["analytics", "visits", "dados_para_estudos"]) {
    try {
      const docs = await databases.listDocuments(databaseId, col, [Query.limit(5)]);
      console.log(col + ": " + docs.total + " docs remaining");
      for (const d of docs.documents) {
        if (col === "analytics") {
          console.log("  id=" + d.$id + " views=" + d.visualizacoes + " clicks=" + d.cliques);
        } else {
          console.log("  id=" + d.$id);
        }
      }
    } catch {
      console.log(col + ": collection not found");
    }
  }
}
check();
