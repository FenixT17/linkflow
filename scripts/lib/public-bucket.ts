/**
 * Shared helper — Storage bucket with public read (Role.any()).
 *
 * Avatars/banners/link images are served on the public /u/[username] page to
 * anonymous visitors via direct storage URLs. Buckets created with
 * Permission.read(Role.users()) return 401 for anonymous requests → broken
 * images. create/update/delete stay restricted to authenticated users.
 *
 * Used by:
 *  - scripts/provision-appwrite.ts (fresh + existing setups)
 *  - scripts/fix-bucket-public.ts (existing buckets only)
 */

import { Storage, Permission, Role, Query } from "node-appwrite";

const BUCKET_PERMS = [
  Permission.read(Role.any()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

// `create` is intentionally omitted: not meaningful at file level.
const FILE_PERMS = [
  Permission.read(Role.any()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

/**
 * Creates the bucket with public read, or updates an existing bucket and all
 * its files to public read. Idempotent — safe to run repeatedly.
 */
export async function ensureBucketWithPublicRead(
  storage: Storage,
  bucketId: string,
  name: string
) {
  try {
    await storage.createBucket(bucketId, name, BUCKET_PERMS, true);
    console.log(`   ✓ Bucket ${bucketId} created with public read.`);
    // Fresh bucket has no files — nothing else to fix.
    return;
  } catch (error: unknown) {
    const err = error instanceof Error ? (error as Error & { code?: number }) : undefined;
    const message = err?.message ?? String(error);
    // Existing bucket: Appwrite may return 409, "already exists", or — on the
    // free plan — "maximum number of buckets allowed" when the bucket exists.
    const bucketExists =
      err?.code === 409 ||
      message.includes("already exists") ||
      message.includes("maximum number of buckets allowed");
    if (!bucketExists) throw error;
    console.log(`   ↳ Bucket ${bucketId} already exists — applying public read...`);
    await storage.updateBucket(bucketId, name, BUCKET_PERMS, true);
    console.log(`   ✓ Bucket ${bucketId} updated to public read.`);
  }

  // Belt & suspenders: apply public read explicitly to existing files.
  // Most inherit bucket permissions dynamically, but this guarantees files
  // created with their own permissions (pre-fix) are covered too.
  let offset = 0;
  for (;;) {
    const { files } = await storage.listFiles(bucketId, [
      Query.limit(100),
      Query.offset(offset),
    ]);
    for (const file of files) {
      try {
        await storage.updateFile(bucketId, file.$id, file.name, FILE_PERMS);
      } catch (e: unknown) {
        console.warn(
          `   ↳ Failed to update file ${file.$id}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    if (files.length < 100) break;
    offset += files.length;
  }
}
