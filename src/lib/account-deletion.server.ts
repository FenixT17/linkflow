import { Models, Query, Databases, Storage, Users } from "node-appwrite";
import { createServerClient, databaseId, accountFileBucketIds } from "./appwrite.server";
import { hashForLog } from "./sanitize";
import {
  ACCOUNT_COLLECTIONS,
  PAGE_SCOPED_COLLECTIONS,
  USER_SCOPED_OWNER_FIELD,
  addUniqueId,
  collectAnalyticsVisitorHashes,
  fileBelongsToUser,
} from "./account-deletion";

type Document = Models.Document & Record<string, unknown>;
type File = Models.File & { $permissions?: string[] };

const PAGE_SIZE = 100;

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { code?: unknown; status?: unknown }).code ?? (error as { status?: unknown }).status;
  return typeof value === "number" ? value : undefined;
}

function isNotFound(error: unknown): boolean {
  return errorStatus(error) === 404;
}

async function listAllDocuments(
  databases: Databases,
  collectionId: string,
  queries: string[] = []
): Promise<Document[]> {
  const documents: Document[] = [];
  let offset = 0;

  try {
    while (true) {
      const response = await databases.listDocuments(databaseId, collectionId, [
        ...queries,
        Query.limit(PAGE_SIZE),
        Query.offset(offset),
      ]);
      const batch = response.documents as Document[];
      documents.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      offset += batch.length;
    }
  } catch (error) {
    // Optional collections may not exist in older installations. A missing
    // collection contains no data to erase; every other error is propagated.
    if (isNotFound(error)) return [];
    throw error;
  }

  return documents;
}

async function deleteDocument(
  databases: Databases,
  collectionId: string,
  documentId: string
): Promise<void> {
  try {
    await databases.deleteDocument(databaseId, collectionId, documentId);
  } catch (error) {
    // Idempotency is important when a request is retried after a partial
    // failure: an already removed document is already compliant.
    if (!isNotFound(error)) throw error;
  }
}

async function deleteDocuments(
  databases: Databases,
  collectionId: string,
  documents: readonly Document[]
): Promise<void> {
  for (const document of documents) {
    await deleteDocument(databases, collectionId, document.$id);
  }
}

async function listAllFiles(storage: Storage, bucketId: string): Promise<File[]> {
  const files: File[] = [];
  let offset = 0;

  try {
    while (true) {
      const response = await storage.listFiles(bucketId, [
        Query.limit(PAGE_SIZE),
        Query.offset(offset),
      ]);
      const batch = response.files as File[];
      files.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      offset += batch.length;
    }
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }

  return files;
}

async function deleteFile(storage: Storage, bucketId: string, fileId: string): Promise<void> {
  try {
    await storage.deleteFile(bucketId, fileId);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

/**
 * Permanently removes every application resource attributable to one user,
 * including the Appwrite Auth identity (email, nome, password, OAuth e estado
 * de verificação).
 *
 * HISTÓRICO: a identidade era preservada de propósito — o comentário dizia
 * "para o email e o nome continuarem disponíveis em Auth". Na prática deixava
 * a conta a meio caminho: os dados desapareciam, mas o login continuava a
 * funcionar, e quem voltasse a entrar recriava o perfil. O utilizador via a
 * app dizer que a conta tinha sido apagada e o Appwrite discordava — e uma
 * eliminação que não elimina identidade não serve para efeitos de RGPD/LGPD.
 * A UI sempre prometeu "A sua conta será apagada permanentemente"; a
 * implementação passou a cumprir.
 *
 * A identidade é apagada em ÚLTIMO lugar (fim da função). Enquanto existir, o
 * utilizador consegue autenticar-se e repetir a operação se algo falhar a meio;
 * apagada primeiro, os dados restantes ficariam sem forma de serem alcançados.
 *
 * Todas as sessões são revogadas no início, para fechar o acesso de imediato.
 * O Appwrite não tem transações entre coleções, por isso a operação é
 * idempotente (404 tolerado) e pode ser repetida.
 */
export async function deleteAccountData(idUtilizador: string, email: string): Promise<void> {
  if (!idUtilizador.trim()) throw new Error("Missing user id");

  const { databases, storage, users } = createServerClient();
  const adminUsers = users as Users;

  // Revoke sessions before starting the non-transactional cleanup. This
  // closes the authenticated user's access immediately, even if a later
  // collection or storage operation needs to be retried.
  await adminUsers.deleteSessions(idUtilizador);

  const pageIds = new Set<string>();
  const fileIds = new Set<string>();
  const visitorHashes = new Set<string>();

  // Discover the account's pages and all page-owned child records before
  // deleting anything. This also captures files from old/replaced uploads.
  const userDocuments = await listAllDocuments(
    databases,
    ACCOUNT_COLLECTIONS.users,
    [Query.equal("idUtilizador", idUtilizador)]
  );
  const pages = await listAllDocuments(
    databases,
    ACCOUNT_COLLECTIONS.pages,
    [Query.equal("idUtilizador", idUtilizador)]
  );
  pages.forEach((page) => {
    addUniqueId(pageIds, page.$id);
    addUniqueId(fileIds, page.idAvatar);
    addUniqueId(fileIds, page.idBanner);
  });

  // Unpublish before deleting children. Public tracking routes require a
  // published page, which prevents new view/click documents from being
  // created while the cleanup is in progress.
  for (const page of pages) {
    try {
      await databases.updateDocument(databaseId, ACCOUNT_COLLECTIONS.pages, page.$id, {
        publicado: false,
        aEliminar: true,
      });
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  const pageDocuments = [...pageIds].map((id) => ({ $id: id }) as Document);
  const pageChildren: Array<[string, Document[]]> = [];

  for (const collectionId of PAGE_SCOPED_COLLECTIONS) {
    const documents: Document[] = [];
    for (const idPagina of pageIds) {
      documents.push(...await listAllDocuments(databases, collectionId, [Query.equal("idPagina", idPagina)]));
    }
    pageChildren.push([collectionId, documents]);

    for (const document of documents) {
      addUniqueId(fileIds, document.idImagem);
      addUniqueId(fileIds, document.idLogo);
      if (collectionId === ACCOUNT_COLLECTIONS.analytics) {
        collectAnalyticsVisitorHashes(document.metricasJson, visitorHashes);
      }
      if (collectionId === ACCOUNT_COLLECTIONS.visits) {
        addUniqueId(visitorHashes, document.hashVisitante);
        addUniqueId(visitorHashes, document.ip);
      }
    }
  }

  // `collected_ips` is global, so only remove a hash when no other page still
  // references it. This prevents deleting another user's deduplication data.
  if (visitorHashes.size > 0) {
    const otherPageVisitorHashes = new Set<string>();
    const allVisits = await listAllDocuments(databases, ACCOUNT_COLLECTIONS.visits);
    for (const visit of allVisits) {
      if (!pageIds.has(String(visit.idPagina ?? ""))) {
        addUniqueId(otherPageVisitorHashes, visit.hashVisitante);
        addUniqueId(otherPageVisitorHashes, visit.ip);
      }
    }

    const allAnalytics = await listAllDocuments(databases, ACCOUNT_COLLECTIONS.analytics);
    for (const analytics of allAnalytics) {
      if (!pageIds.has(String(analytics.idPagina ?? ""))) {
        collectAnalyticsVisitorHashes(analytics.metricasJson, otherPageVisitorHashes);
      }
    }

    const collectedIpDocuments = await listAllDocuments(databases, ACCOUNT_COLLECTIONS.collectedIps);
    await deleteDocuments(
      databases,
      ACCOUNT_COLLECTIONS.collectedIps,
      collectedIpDocuments.filter((document) => {
        const hash = String(document.hashVisitante ?? document.ip ?? "");
        return visitorHashes.has(hash) && !otherPageVisitorHashes.has(hash);
      })
    );
  }

  // Remove page children bottom-up, then the pages themselves.
  for (const [collectionId, documents] of pageChildren) {
    await deleteDocuments(databases, collectionId, documents);
  }
  // A view/click that raced with the first discovery may have created a child
  // document after the initial snapshot. Re-query once after unpublishing and
  // remove those late records before deleting the page itself.
  for (const collectionId of PAGE_SCOPED_COLLECTIONS) {
    const lateDocuments: Document[] = [];
    for (const idPagina of pageIds) {
      lateDocuments.push(...await listAllDocuments(databases, collectionId, [Query.equal("idPagina", idPagina)]));
    }
    await deleteDocuments(databases, collectionId, lateDocuments);
  }
  await deleteDocuments(databases, ACCOUNT_COLLECTIONS.pages, pageDocuments);

  // Remove all account-scoped documents, including logs, subscriptions and
  // staff applications that do not depend on a page.
  // NOTA (Sessão 43): a coleção `teams` usa `idProprietario` (não `idUtilizador`) como
  // campo do dono — ver USER_SCOPED_OWNER_FIELD. Consultar `idUtilizador` aí
  // falhava com "Attribute not found in schema: idUtilizador" e abortava a
  // exclusão DEPOIS de as páginas já terem sido apagadas.
  for (const [collectionId, ownerField] of Object.entries(USER_SCOPED_OWNER_FIELD)) {
    const documents = await listAllDocuments(databases, collectionId, [
      Query.equal(ownerField, idUtilizador),
    ]);
    await deleteDocuments(databases, collectionId, documents);
  }

  // Security logs have both authenticated rows and pre-authentication rows.
  // The latter contain a one-way email hash and may include the authenticated
  // user id in metadata after a successful login.
  const securityLogs = await listAllDocuments(databases, ACCOUNT_COLLECTIONS.securityLogs);
  const emailHash = email.trim() ? await hashForLog(email.trim()) : "";
  const accountSecurityLogs = securityLogs.filter((document) => {
    if (String(document.idUtilizador ?? "") === idUtilizador) return true;
    if (emailHash && String(document.email ?? "") === emailHash) return true;
    return String(document.metadados ?? "").includes(idUtilizador);
  });
  await deleteDocuments(databases, ACCOUNT_COLLECTIONS.securityLogs, accountSecurityLogs);

  await deleteDocuments(databases, ACCOUNT_COLLECTIONS.users, userDocuments);

  // Delete every file owned by the user, including old uploads no longer
  // referenced by a page. Referenced files are included defensively as well.
  for (const bucketId of accountFileBucketIds) {
    const files = await listAllFiles(storage, bucketId);
    for (const file of files) {
      if (fileIds.has(file.$id) || fileBelongsToUser(file.$permissions, idUtilizador)) {
        await deleteFile(storage, bucketId, file.$id);
      }
    }
  }

  // Identidade de Auth do Appwrite — email, nome, password, OAuth e estado de
  // verificação. É o ÚLTIMO passo de propósito: enquanto existir, o utilizador
  // consegue voltar a autenticar-se e repetir a eliminação se algum passo acima
  // tiver falhado a meio. Apagá-la primeiro deixaria os restantes dados
  // inalcançáveis (ninguém poderia autenticar-se para os remover).
  //
  // Depende do scope `users.write` na API key (ver .env.example). Se faltar, o
  // erro é propagado de propósito: falhar em silêncio faria o utilizador crer
  // que a conta desapareceu quando a identidade continua viva.
  // Idempotente: uma identidade já apagada (404) conta como sucesso.
  try {
    await adminUsers.delete(idUtilizador);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

/** Exposed for focused tests without touching Appwrite. */
export const accountDeletionInternals = {
  isNotFound,
};
