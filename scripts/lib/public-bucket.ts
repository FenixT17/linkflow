/**
 * Shared helper — Storage bucket with public read (Role.any()).
 *
 * Avatars/banners/link images are served on the public /u/[username] page to
 * anonymous visitors via direct storage URLs. Buckets created with
 * Permission.read(Role.users()) return 401 for anonymous requests → broken
 * images.
 *
 * Sessão 36 (least-privilege): o bucket NÃO tem update/delete: users().
 * Antes, qualquer utilizador autenticado podia apagar/substituir ficheiros de
 * terceiros (as permissões de bucket aplicam-se a todos os ficheiros que as
 * herdam). O update/delete é agora concedido POR FICHEIRO ao dono
 * (Role.user(owner)), definido no uploadFile do client SDK.
 *
 * Used by:
 *  - scripts/provision-appwrite.ts (fresh + existing setups)
 *  - scripts/fix-bucket-public.ts (existing buckets only)
 */

import { Databases, Storage, Permission, Role, Query } from "node-appwrite";

const BUCKET_PERMS = [
  Permission.read(Role.any()),
  Permission.create(Role.users()),
];

/** Permissões por ficheiro para o dono (update/delete restritos ao owner). */
function filePermsForOwner(ownerId: string) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),
  ];
}

/**
 * Backfill: aplica permissões por dono aos ficheiros existentes (criados
 * antes da Sessão 36, quando o bucket tinha update/delete: users() e os
 * ficheiros herdavam essas permissões). O dono de cada ficheiro é derivado
 * das coleções pages (avatarId/bannerId) — ficheiros órfãos ficam apenas
 * com read público e sem update/delete (ninguém os pode apagar/substituir).
 */
async function applyOwnerPermsToExistingFiles(
  storage: Storage,
  databases: Databases,
  databaseId: string,
  bucketId: string
) {
  // Mapa fileId → ownerId derivado das páginas (avatar/banner) e dos links
  // (imageId). Sem isto, as imagens de links ficariam órfãs (read-only para
  // todos, sem update/delete para ninguém — storage leak irreversível).
  const ownerByFile = new Map<string, string>();
  const ownerByPage = new Map<string, string>();
  let offset = 0;
  for (;;) {
    const { documents } = await databases.listDocuments(databaseId, "pages", [
      Query.limit(100),
      Query.offset(offset),
      Query.select(["$id", "avatarId", "bannerId", "userId"]),
    ]);
    for (const doc of documents) {
      const ownerId = String(doc.userId ?? "");
      if (!ownerId) continue;
      ownerByPage.set(doc.$id, ownerId);
      const avatarId = String(doc.avatarId ?? "");
      if (avatarId) ownerByFile.set(avatarId, ownerId);
      const bannerId = String(doc.bannerId ?? "");
      if (bannerId) ownerByFile.set(bannerId, ownerId);
    }
    if (documents.length < 100) break;
    offset += documents.length;
  }

  // Imagens de links: imageId → dono da página dona do link.
  let linksOffset = 0;
  for (;;) {
    const { documents } = await databases.listDocuments(databaseId, "links", [
      Query.limit(100),
      Query.offset(linksOffset),
      Query.select(["pageId", "imageId"]),
    ]);
    for (const doc of documents) {
      const imageId = String(doc.imageId ?? "");
      if (!imageId) continue;
      const ownerId = ownerByPage.get(String(doc.pageId ?? ""));
      if (ownerId) ownerByFile.set(imageId, ownerId);
    }
    if (documents.length < 100) break;
    linksOffset += documents.length;
  }

  let filesOffset = 0;
  for (;;) {
    const { files } = await storage.listFiles(bucketId, [
      Query.limit(100),
      Query.offset(filesOffset),
    ]);
    for (const file of files) {
      const ownerId = ownerByFile.get(file.$id);
      if (!ownerId) continue; // Órfão — mantém apenas read público (sem update/delete)
      try {
        await storage.updateFile(bucketId, file.$id, file.name, filePermsForOwner(ownerId));
        console.log(`   ↳ File ${file.$id} scoped to owner ${ownerId}.`);
      } catch (e: unknown) {
        console.warn(
          `   ↳ Failed to scope file ${file.$id}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    if (files.length < 100) break;
    filesOffset += files.length;
  }
}

/**
 * Creates the bucket with public read, or updates an existing bucket and all
 * its files to public read. Idempotent — safe to run repeatedly.
 */
/**
 * Cria/atualiza o bucket com read público e SEM update/delete users().
 * Idempotente. Se `databases` for passado (fix de bucket existente), aplica
 * também as permissões por dono aos ficheiros existentes (backfill).
 */
export async function ensureBucketWithPublicRead(
  storage: Storage,
  bucketId: string,
  name: string,
  databases?: Databases,
  databaseId = "linkflow"
) {
  try {
    await storage.createBucket(bucketId, name, BUCKET_PERMS, true);
    console.log(`   ✓ Bucket ${bucketId} created with public read (least-privilege).`);
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
    console.log(`   ↳ Bucket ${bucketId} already exists — applying least-privilege perms...`);
    await storage.updateBucket(bucketId, name, BUCKET_PERMS, true);
    console.log(`   ✓ Bucket ${bucketId} updated (read public, no update/delete for users).`);
  }

  // Backfill de ficheiros existentes (só quando temos acesso às databases).
  // Sem isto, os ficheiros antigos continuavam com update/delete: users()
  // herdados do bucket — qualquer utilizador podia apagá-los.
  if (databases) {
    await applyOwnerPermsToExistingFiles(storage, databases, databaseId, bucketId);
  }
}
