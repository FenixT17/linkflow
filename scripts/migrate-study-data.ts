import { Client, Databases, Models, Query } from "node-appwrite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
  process.env.APPWRITE_ENDPOINT ??
  "https://nyc.cloud.appwrite.io/v1";
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ??
  process.env.APPWRITE_DATABASE_ID ??
  "linkflow";
const collectionId = "dados_para_estudos";

if (!projectId || !apiKey) {
  console.error(
    "Missing required environment variables: NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY"
  );
  process.exit(1);
}

const databases = new Databases(
  new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
);

function documentField(document: Models.Document, key: string): unknown {
  return (document as Models.Document & Record<string, unknown>)[key];
}

function documentCreatedAt(document: Models.Document): string {
  const value = documentField(document, "createdAt");
  return typeof value === "string" ? value : document.$createdAt;
}

async function listAllDocuments(): Promise<Models.Document[]> {
  const documents: Models.Document[] = [];
  let cursor: string | undefined;

  do {
    const queries = [Query.limit(100), Query.orderAsc("createdAt")];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const page = await databases.listDocuments(databaseId, collectionId, queries);
    documents.push(...page.documents);
    cursor = page.documents.at(-1)?.$id;

    if (page.documents.length < 100) break;
  } while (cursor);

  return documents;
}

async function migrate() {
  console.log("🔎 Procurando duplicados em dados_para_estudos...");
  const documents = await listAllDocuments();
  const firstByIp = new Map<string, Models.Document>();
  const duplicates: Models.Document[] = [];
  const invalidDocuments = documents.filter((document) => {
    const rawIp = documentField(document, "ip");
    const ip = typeof rawIp === "string" ? rawIp.trim() : "";
    return !ip;
  });

  // A ordenação por createdAt mantém o primeiro registo histórico. O desempate
  // por $id torna o resultado determinístico se dois documentos tiverem a
  // mesma data.
  for (const document of documents) {
    const rawIp = documentField(document, "ip");
    const ip = typeof rawIp === "string" ? rawIp.trim() : "";
    if (!ip) continue;

    const first = firstByIp.get(ip);
    if (!first) {
      firstByIp.set(ip, document);
      continue;
    }

    const firstKey = `${documentCreatedAt(first)}\u0000${first.$id}`;
    const currentKey = `${documentCreatedAt(document)}\u0000${document.$id}`;
    if (currentKey < firstKey) {
      duplicates.push(first);
      firstByIp.set(ip, document);
    } else {
      duplicates.push(document);
    }
  }

  const toDelete = [...invalidDocuments, ...duplicates];
  if (toDelete.length === 0) {
    console.log(`✅ Nenhum duplicado encontrado (${documents.length} documentos verificados).`);
    return;
  }

  console.log(
    `🧹 A eliminar ${toDelete.length} registo(s): ${duplicates.length} duplicado(s) e ${invalidDocuments.length} sem IP válido. Os primeiros registos serão preservados.`
  );
  for (const document of toDelete) {
    await databases.deleteDocument(databaseId, collectionId, document.$id);
  }

  console.log(
    `✅ Migração concluída: ${duplicates.length} duplicado(s) + ${invalidDocuments.length} inválido(s) removido(s), ${firstByIp.size} IP(s) único(s) preservado(s).`
  );
}

migrate().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ Migração falhou: ${message}`);
  process.exit(1);
});
