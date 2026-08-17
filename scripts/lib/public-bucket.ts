/**
 * Shared helper — private Storage bucket for server-proxied public media.
 *
 * Avatars/banners/link images are served on the public /u/[nomeUtilizador] page
 * through `/api/media/[fileId]`. The Worker reads them with the server API
 * key, so the Appwrite bucket no longer needs public read access. This makes
 * direct bulk downloads from the Appwrite Storage endpoint impossible without
 * the secret key.
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
  Permission.create(Role.users()),
];

/** Permissões por ficheiro para o dono (update/delete restritos ao owner). */
function filePermsForOwner(idProprietario: string) {
  return [
    Permission.read(Role.user(idProprietario)),
    Permission.update(Role.user(idProprietario)),
    Permission.delete(Role.user(idProprietario)),
  ];
}

/**
 * Backfill: aplica permissões por dono aos ficheiros existentes. O dono de
 * cada ficheiro é derivado das coleções pages (idAvatar/idBanner) e links
 * (idImagem). Ficheiros órfãos ficam sem permissões, para nunca permanecerem
 * publicamente acessíveis depois da migração.
 */
async function applyOwnerPermsToExistingFiles(
  storage: Storage,
  databases: Databases,
  databaseId: string,
  bucketId: string
) {
  // Mapa fileId → idProprietario derivado das páginas (avatar/banner) e dos links
  // (idImagem). Sem isto, as imagens de links ficariam órfãs (read-only para
  // todos, sem update/delete para ninguém — storage leak irreversível).
  const ownerByFile = new Map<string, string>();
  const ownerByPage = new Map<string, string>();
  let offset = 0;
  for (;;) {
    const { documents } = await databases.listDocuments(databaseId, "pages", [
      Query.limit(100),
      Query.offset(offset),
      Query.select(["$id", "idAvatar", "idBanner", "idUtilizador"]),
    ]);
    for (const doc of documents) {
      const idProprietario = String(doc.idUtilizador ?? "");
      if (!idProprietario) continue;
      ownerByPage.set(doc.$id, idProprietario);
      const idAvatar = String(doc.idAvatar ?? "");
      if (idAvatar) ownerByFile.set(idAvatar, idProprietario);
      const idBanner = String(doc.idBanner ?? "");
      if (idBanner) ownerByFile.set(idBanner, idProprietario);
    }
    if (documents.length < 100) break;
    offset += documents.length;
  }

  // Imagens de links: idImagem → dono da página dona do link.
  let linksOffset = 0;
  for (;;) {
    const { documents } = await databases.listDocuments(databaseId, "links", [
      Query.limit(100),
      Query.offset(linksOffset),
      Query.select(["idPagina", "idImagem"]),
    ]);
    for (const doc of documents) {
      const idImagem = String(doc.idImagem ?? "");
      if (!idImagem) continue;
      const idProprietario = ownerByPage.get(String(doc.idPagina ?? ""));
      if (idProprietario) ownerByFile.set(idImagem, idProprietario);
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
      const idProprietario = ownerByFile.get(file.$id);
      try {
        // Orphans get no permissions; owned files are readable only through
        // the server proxy (the owner still retains dashboard management).
        await storage.updateFile(bucketId, file.$id, file.name, idProprietario ? filePermsForOwner(idProprietario) : []);
        console.log(`   ↳ File ${file.$id} scoped to owner ${idProprietario}.`);
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
 * Cria/atualiza o bucket privado sem read público nem update/delete users().
 * Idempotente. Se `databases` for passado, aplica permissões por dono aos
 * ficheiros existentes e remove acesso de ficheiros órfãos.
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
    console.log(`   ✓ Bucket ${bucketId} created as private (server-proxied media).`);
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
    console.log(`   ↳ Bucket ${bucketId} already exists — applying private least-privilege perms...`);
    await storage.updateBucket(bucketId, name, BUCKET_PERMS, true);
    console.log(`   ✓ Bucket ${bucketId} updated as private (no public read).`);
  }

  // Backfill de ficheiros existentes (só quando temos acesso às databases).
  // Sem isto, os ficheiros antigos continuavam com update/delete: users()
  // herdados do bucket — qualquer utilizador podia apagá-los.
  if (databases) {
    await applyOwnerPermsToExistingFiles(storage, databases, databaseId, bucketId);
  }
}
