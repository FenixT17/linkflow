import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Auto-cura do documento de `themes`.
 *
 * Contexto (bug real, verificado em produção): 7 de 9 páginas não tinham
 * documento de `themes`, porque o caminho idempotente do `createPage` fazia
 * `return` cedo sem o criar. `getThemeByPageId` devolvia `$id: ""` e o
 * `updateAppearance` do AuthContext só escreve `if (themeId)` — logo TODAS as
 * alterações de aparência eram descartadas em silêncio.
 *
 * Verifica também que o payload enviado leva os campos REAIS do schema: um
 * allowlist desatualizado no proxy removia-os e a escrita não persistia.
 */

const listDocuments = vi.fn();
const createDocument = vi.fn();
const getDocument = vi.fn();

vi.mock("@/lib/appwrite", () => ({
  databases: {
    listDocuments: (...args: unknown[]) => listDocuments(...args),
    createDocument: (...args: unknown[]) => createDocument(...args),
    getDocument: (...args: unknown[]) => getDocument(...args),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
  account: {},
  databaseId: "linkflow",
  Collections: {
    users: "users",
    pages: "pages",
    links: "links",
    themes: "themes",
    analytics: "analytics",
    activityLogs: "activity_logs",
    staffApplications: "staff_applications",
  },
  Buckets: { files: "files" },
  projectId: "test-project",
  createOAuthAccount: vi.fn(),
}));

import { ensureThemeForPage, invalidateSessionCache } from "@/lib/services";

const PAGE_ID = "page-1";
const USER_ID = "user-1";

/** Documento de tema tal como o Appwrite o devolve. */
function themeDoc($id: string) {
  return {
    $id,
    idPagina: PAGE_ID,
    tema: "glass",
    desfoco: 25,
    arredondado: 16,
    opacidadeLinks: 100,
    corFundo: "#0a0a0a",
    corCartao: "rgba(255,255,255,0.03)",
    corTexto: "#fafafa",
    corDestaque: "#fafafa",
    familiaFonte: "Inter",
    tamanhoFonte: 16,
    raioBotao: 12,
    larguraBotao: "full",
    alturaBotao: "normal",
    estiloBotao: "glass",
    sombra: "md",
    mostrarAvatar: true,
    mostrarBiografia: true,
    mostrarSocial: true,
    espacamento: 6,
    opacidadeVidro: 35,
    desfocoVidro: 25,
    intensidadeVidro: 50,
  };
}

beforeEach(() => {
  invalidateSessionCache();
  listDocuments.mockReset();
  createDocument.mockReset();
  getDocument.mockReset();
  // Sessão autenticada (getCurrentSession → /api/auth/me).
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ user: { $id: USER_ID } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  // A página pertence ao utilizador autenticado (requireOwnerOfPage).
  getDocument.mockResolvedValue({ $id: PAGE_ID, idUtilizador: USER_ID });
});

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateSessionCache();
});

describe("ensureThemeForPage — auto-cura do tema", () => {
  it("devolve o tema existente sem criar nada", async () => {
    listDocuments.mockResolvedValueOnce({ documents: [themeDoc("theme-existing")] });

    const result = await ensureThemeForPage(PAGE_ID);

    expect(result.$id).toBe("theme-existing");
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("cria o documento quando a página não tem tema e devolve o novo id", async () => {
    listDocuments
      .mockResolvedValueOnce({ documents: [] }) // primeira leitura: ausente
      .mockResolvedValueOnce({ documents: [themeDoc("theme-created")] }); // re-leitura
    createDocument.mockResolvedValue({ $id: "theme-created" });

    const result = await ensureThemeForPage(PAGE_ID);

    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(result.$id).toBe("theme-created");

    // createDocument(databaseId, collectionId, documentId, data, permissions)
    const [, collectionId, , data, permissions] = createDocument.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      string[],
    ];
    expect(collectionId).toBe("themes");
    expect(data.idPagina).toBe(PAGE_ID);
    // Permissões do dono, para que o próprio utilizador consiga ler/editar.
    expect(permissions).toContain(`read("user:${USER_ID}")`);
    // Campos reais do schema (o proxy remove qualquer um que não esteja no
    // allowlist — sem eles a escrita não persistiria).
    expect(data.desfoco).toBe(25);
    expect(data.corFundo).toBe("#0a0a0a");
    expect(data.familiaFonte).toBe("Inter");
    expect(data.opacidadeVidro).toBe(35);
    expect(data.mostrarAvatar).toBe(true);
    expect(data.tema).toBe("glass");
  });

  it("trata o 409 (corrida no índice único) como sucesso", async () => {
    listDocuments
      .mockResolvedValueOnce({ documents: [] })
      .mockResolvedValueOnce({ documents: [themeDoc("theme-race")] });
    createDocument.mockRejectedValue(Object.assign(new Error("already exists"), { status: 409 }));

    const result = await ensureThemeForPage(PAGE_ID);

    expect(result.$id).toBe("theme-race");
  });

  it("não bloqueia o dashboard se a criação falhar de vez", async () => {
    listDocuments.mockResolvedValueOnce({ documents: [] });
    createDocument.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await ensureThemeForPage(PAGE_ID);

    // Mantém o comportamento anterior (defaults sem documento) em vez de lançar.
    expect(result.$id).toBe("");
    expect(result.desfoco).toBe(25);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
