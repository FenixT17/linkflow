import { Client, Databases, Permission, Query, Role } from "node-appwrite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? process.env.APPWRITE_DATABASE_ID ?? "linkflow";

if (!projectId || !apiKey) {
  throw new Error("Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY");
}

const databases = new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));

async function migrate() {
  let cursor: string | undefined;
  let migrated = 0;

  do {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await databases.listDocuments(databaseId, "users", queries);

    for (const doc of page.documents) {
      const userId = String(doc.userId ?? "").trim();
      if (!userId) {
        console.warn(`Skipping ${doc.$id}: missing userId`);
        continue;
      }

      // The old client could update plan/email/userId. Until a trusted billing
      // webhook exists, reset every legacy plan to the safe free baseline.
      await databases.updateDocument(
        databaseId,
        "users",
        doc.$id,
        {
          userId,
          email: String(doc.email ?? ""),
          displayName: String(doc.displayName ?? "Utilizador"),
          plan: "free",
          country: String(doc.country ?? ""),
          countryCode: String(doc.countryCode ?? ""),
          currency: String(doc.currency ?? "EUR"),
          createdAt: String(doc.createdAt ?? new Date().toISOString()),
        },
        [Permission.read(Role.user(userId))]
      );
      migrated++;
    }

    cursor = page.documents.length === 100 ? page.documents[page.documents.length - 1]?.$id : undefined;
  } while (cursor);

  console.log(`Migrated ${migrated} user profile(s) to read-only owner permissions.`);
}

migrate().catch((error) => {
  console.error("Users migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
