import { Client, Databases, Permission, Query, Role } from "node-appwrite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT ?? "https://nyc.cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? process.env.APPWRITE_DATABASE_ID ?? "linkflow";
const collectionId = "staff_applications";

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
    const page = await databases.listDocuments(databaseId, collectionId, queries);

    for (const doc of page.documents) {
      const userId = String(doc.userId ?? "").trim();
      if (!userId) {
        console.warn(`Skipping ${doc.$id}: missing userId`);
        continue;
      }

      // Any approval created before this migration is untrusted: the old
      // client could write status (and there was no trusted reviewer field).
      // Force a fresh manual review after permissions are repaired.
      const status = String(doc.status ?? "pending");
      const safeStatus = status === "rejected" ? "rejected" : "pending";

      await databases.updateDocument(
        databaseId,
        collectionId,
        doc.$id,
        {
          status: safeStatus,
          reviewedBy: "",
        },
        [Permission.read(Role.user(userId))]
      );
      migrated++;
    }

    cursor = page.documents.length === 100 ? page.documents[page.documents.length - 1]?.$id : undefined;
  } while (cursor);

  console.log(`Migrated ${migrated} staff application(s).`);
}

migrate().catch((error) => {
  console.error("Staff application migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
