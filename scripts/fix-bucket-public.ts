/**
 * Fix — Storage Bucket with Public Read
 *
 * Avatars, banners and link images are served on the public /u/[username]
 * page through the same-origin `/api/media/[fileId]` proxy. The Appwrite
 * bucket must therefore remain private; the Worker reads files with its
 * server API key.
 *
 * This script fixes an EXISTING bucket without touching databases:
 *   1. Removes bucket-level public read access
 *   2. Scopes existing files to their owners (the proxy uses the API key)
 *
 * Usage:
 *   npm run fix:bucket
 */

import { Client, Databases, Storage } from "node-appwrite";
import dotenv from "dotenv";
import { ensureBucketWithPublicRead } from "./lib/public-bucket";

dotenv.config({ path: ".env.local" });

// Convention: NEXT_PUBLIC_APPWRITE_* is the canonical name (same as the runtime
// code and .env.example). Legacy non-prefixed aliases are accepted for backwards
// compatibility with older .env.local files.
const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
  process.env.APPWRITE_ENDPOINT ??
  "https://cloud.appwrite.io/v1";
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const bucketId =
  process.env.NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID ??
  process.env.APPWRITE_FILES_BUCKET_ID ??
  "files";
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ??
  process.env.APPWRITE_DATABASE_ID ??
  "linkflow";

if (!projectId || !apiKey) {
  console.error(
    "Missing required environment variables: NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY"
  );
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const storage = new Storage(client);
const databases = new Databases(client);

async function main() {
  console.log("🔧 Fixing storage bucket permissions...\n");
  console.log(`📦 Bucket: ${bucketId}`);
  console.log(`🔑 Project: ${projectId}\n`);

  // Print current permissions when the bucket exists (nice-to-have for debugging).
  // The helper itself handles both create and update paths, so a missing bucket
  // must not abort the fix. Capturing the real display name also prevents
  // updateBucket from renaming an existing bucket to the lowercase id.
  let bucketName = bucketId;
  try {
    const bucket = await storage.getBucket(bucketId);
    bucketName = bucket.name;
    console.log(`   ↳ Current bucket permissions: ${JSON.stringify(bucket.$permissions ?? [])}`);
  } catch {
    console.log(`   ↳ Bucket ${bucketId} does not exist yet — will be created.`);
  }

  // Passa as databases para o backfill: os ficheiros existentes são
  // re-scoped para permissões por dono (sem leitura pública). O proxy usa
  // a API key do Worker para servir as imagens na página pública.
  await ensureBucketWithPublicRead(storage, bucketId, bucketName, databases, databaseId);

  console.log("\n✅ Done. Bucket: private (no public read).");
  console.log("   Avatars/banners remain visible through the protected Worker proxy; files are scoped to owners.");
}

main().catch((error: unknown) => {
  console.error("\n❌ Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
