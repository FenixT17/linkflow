import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes de execução do `deleteAccountData` (ordem e semântica de falha).
 *
 * Regressão: a identidade de Auth do Appwrite era PRESERVADA de propósito
 * ("para o email e o nome continuarem disponíveis em Auth"). O resultado era
 * uma conta a meio caminho — dados apagados, login a funcionar, e quem voltasse
 * a entrar recriava o perfil. Verificado em produção: uma conta nesse estado
 * voltou a autenticar-se duas vezes depois da eliminação. A UI sempre prometeu
 * "A sua conta será apagada permanentemente".
 *
 * Estes testes não tocam no Appwrite: os clientes são falsos e registam as
 * chamadas pela ordem em que acontecem.
 */

const h = vi.hoisted(() => {
  const USER = "user-1";
  const PAGE = "page-1";
  const calls: string[] = [];
  const state = {
    identityError: null as null | { code: number },
    fileDeleteError: null as null | { code: number },
  };

  const databases = {
    listDocuments: async (_db: string, collectionId: string) => {
      calls.push(`list:${collectionId}`);
      if (collectionId === "users") {
        return { documents: [{ $id: "userdoc-1", idUtilizador: USER }], total: 1 };
      }
      if (collectionId === "pages") {
        return { documents: [{ $id: PAGE, idUtilizador: USER, idAvatar: "", idBanner: "" }], total: 1 };
      }
      if (collectionId === "links") {
        return { documents: [{ $id: "link-1", idPagina: PAGE }], total: 1 };
      }
      return { documents: [], total: 0 };
    },
    deleteDocument: async (_db: string, collectionId: string, id: string) => {
      calls.push(`delete:${collectionId}:${id}`);
    },
    updateDocument: async (_db: string, collectionId: string, id: string) => {
      calls.push(`update:${collectionId}:${id}`);
      return {};
    },
  };

  const storage = {
    listFiles: async () => ({
      docs: [],
      files: [{ $id: "file-1", $permissions: [`delete("user:${USER}")`] }],
      total: 1,
    }),
    deleteFile: async (_bucket: string, fileId: string) => {
      calls.push(`deleteFile:${fileId}`);
      if (state.fileDeleteError) throw state.fileDeleteError;
    },
  };

  const users = {
    deleteSessions: async () => {
      calls.push("deleteSessions");
    },
    delete: async (id: string) => {
      calls.push(`deleteIdentity:${id}`);
      if (state.identityError) throw state.identityError;
    },
  };

  return { USER, PAGE, calls, state, databases, storage, users };
});

vi.mock("@/lib/appwrite.server", () => ({
  createServerClient: () => ({ databases: h.databases, storage: h.storage, users: h.users }),
  databaseId: "linkflow",
  accountFileBucketIds: ["files"],
}));

import { deleteAccountData } from "@/lib/account-deletion.server";

const EMAIL = "delete-me@example.com";

describe("deleteAccountData — identidade de Auth", () => {
  beforeEach(() => {
    h.calls.length = 0;
    h.state.identityError = null;
    h.state.fileDeleteError = null;
  });

  it("apaga a identidade de Auth do Appwrite", async () => {
    await deleteAccountData(h.USER, EMAIL);

    expect(h.calls).toContain(`deleteIdentity:${h.USER}`);
  });

  it("apaga a identidade em ÚLTIMO lugar, depois dos dados e dos ficheiros", async () => {
    await deleteAccountData(h.USER, EMAIL);

    const identityAt = h.calls.indexOf(`deleteIdentity:${h.USER}`);
    const pageAt = h.calls.indexOf(`delete:pages:${h.PAGE}`);
    const fileAt = h.calls.indexOf("deleteFile:file-1");

    // Os passos anteriores correram mesmo (sem isto a ordem seria trivial).
    expect(pageAt).toBeGreaterThanOrEqual(0);
    expect(fileAt).toBeGreaterThanOrEqual(0);

    expect(identityAt).toBeGreaterThan(pageAt);
    expect(identityAt).toBeGreaterThan(fileAt);
    // Nada acontece depois: enquanto a identidade existir, uma repetição é
    // possível; apagada primeiro, os dados restantes ficariam inalcançáveis.
    expect(identityAt).toBe(h.calls.length - 1);
  });

  it("revoga as sessões antes de mexer nos dados", async () => {
    await deleteAccountData(h.USER, EMAIL);

    expect(h.calls[0]).toBe("deleteSessions");
  });

  it("é idempotente: uma identidade já apagada (404) não rebenta", async () => {
    h.state.identityError = { code: 404 };

    await expect(deleteAccountData(h.USER, EMAIL)).resolves.toBeUndefined();
  });

  it("propaga qualquer outro erro ao apagar a identidade (nunca finge sucesso)", async () => {
    h.state.identityError = { code: 500 };

    await expect(deleteAccountData(h.USER, EMAIL)).rejects.toMatchObject({ code: 500 });
  });

  it("se um passo de dados falhar, a identidade NÃO é apagada (permite repetir)", async () => {
    h.state.fileDeleteError = { code: 500 };

    await expect(deleteAccountData(h.USER, EMAIL)).rejects.toMatchObject({ code: 500 });

    expect(h.calls).not.toContain(`deleteIdentity:${h.USER}`);
  });
});
