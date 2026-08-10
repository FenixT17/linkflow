import { Client, Databases, Storage, Users } from "node-appwrite";
import { normalizeEnvUrl } from "@/lib/utils";

const endpoint = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  "https://nyc.cloud.appwrite.io/v1"
);
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const apiKey = process.env.APPWRITE_API_KEY ?? "";
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "linkflow";

export const filesBucketId = process.env.NEXT_PUBLIC_APPWRITE_FILES_BUCKET_ID ?? "files";
export const accountFileBucketIds = [
  filesBucketId,
  process.env.NEXT_PUBLIC_APPWRITE_AVATARS_BUCKET_ID ?? process.env.APPWRITE_AVATARS_BUCKET_ID ?? "avatars",
  process.env.NEXT_PUBLIC_APPWRITE_BANNERS_BUCKET_ID ?? process.env.APPWRITE_BANNERS_BUCKET_ID ?? "banners",
].filter((bucketId, index, buckets) => bucketId && buckets.indexOf(bucketId) === index);

export function createServerClient() {
  const missing: string[] = [];
  if (!projectId) missing.push("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  if (!apiKey) missing.push("APPWRITE_API_KEY");
  if (missing.length > 0) {
    const error = new Error(`Appwrite is not configured. Missing: ${missing.join(", ")}`);
    (error as Error & { status?: number }).status = 503;
    throw error;
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return {
    databases: new Databases(client),
    storage: new Storage(client),
    users: new Users(client),
  };
}

export function isAppwriteConfigured(): boolean {
  return Boolean(projectId && apiKey);
}

export { databaseId };
