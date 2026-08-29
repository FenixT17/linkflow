import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * O proxy /api/appwrite encaminha mutações de documentos com a sessão HttpOnly
 * do browser. As coleções de conteúdo (links, themes, analytics, qr_codes)
 * têm `create: Role.users()` no Appwrite — sem validação no proxy, um atacante
 * autenticado criava documentos com `idPagina` de OUTRAS páginas, injetando
 * links/temas em páginas de terceiros (a renderização pública lê por idPagina
 * com API key e nunca valida o dono). O mesmo vale para o campo dono em
 * pages/activity_logs/notifications/subscriptions/teams.
 *
 * Estes testes verificam que o proxy bloqueia criações/edições que referenciam
 * dados que não pertencem à sessão autenticada.
 */
describe("appwrite proxy document ownership", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  /**
   * Mock do fetch upstream do proxy:
   * - GET /account → devolve o utilizador da sessão
   * - GET /collections/pages/documents/{id} → devolve o dono da página
   * - GET /collections/users/documents → plano "pro" (o limite de links não
   *   aplica — estes testes focam apenas a validação de propriedade)
   * - GET /collections/links/documents (contagem) → abaixo do limite
   * - qualquer outro pedido (o encaminhamento real) → 201
   */
  function stubFetch(account: { $id: string }, pageOwnerByPageId: Record<string, string>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/account")) {
          return jsonResponse(200, account);
        }
        const pageMatch = url.match(/\/collections\/pages\/documents\/([^/?#]+)/);
        if (pageMatch) {
          const id = decodeURIComponent(pageMatch[1]);
          const owner = pageOwnerByPageId[id];
          return owner !== undefined
            ? jsonResponse(200, { idUtilizador: owner })
            : jsonResponse(404, { message: "Not found" });
        }
        if (url.includes("/collections/users/documents")) {
          return jsonResponse(200, { total: 1, documents: [{ plano: "pro" }] });
        }
        if (url.includes("/collections/links/documents") && url.includes("queries")) {
          return jsonResponse(200, { total: 0, documents: [] });
        }
        return jsonResponse(201, { $id: "created" });
      })
    );
  }

  async function importRoute() {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    return import("@/app/api/appwrite/[...path]/route");
  }

  function makeRequest(pathSegments: string[], method: string, body?: string, sessionSecret = "session-1") {
    const request = new NextRequest(`https://example.com/api/appwrite/${pathSegments.join("/")}`, {
      method,
      headers: body
        ? { "content-type": "application/json", "x-csrf-token": "valid-token" }
        : { "x-csrf-token": "valid-token" },
      body,
    });
    request.cookies.set("csrf-token", "valid-token");
    // Nome do cookie de sessão em dev/test (NODE_ENV !== production).
    request.cookies.set("linkflow-session", sessionSecret);
    return request;
  }

  const LINKS_CREATE = ["databases", "db", "collections", "links", "documents"];
  const LINKS_UPDATE = ["databases", "db", "collections", "links", "documents", "link-1"];
  const ACTIVITY_CREATE = ["databases", "db", "collections", "activity_logs", "documents"];
  const PAGES_CREATE = ["databases", "db", "collections", "pages", "documents"];

  it("bloqueia a criação de um link com idPagina de OUTRA página (injeção)", async () => {
    stubFetch({ $id: "attacker-1" }, { "own-page": "attacker-1", "victim-page": "victim-1" });
    const { POST } = await importRoute();

    const body = JSON.stringify({ data: { idPagina: "victim-page", titulo: "spam", url: "https://evil.example" } });
    const response = await POST(makeRequest(LINKS_CREATE, "POST", body), {
      params: Promise.resolve({ path: LINKS_CREATE }),
    });
    expect(response.status).toBe(403);
  });

  it("bloqueia a criação de link sem idPagina", async () => {
    stubFetch({ $id: "attacker-1" }, { "own-page": "attacker-1" });
    const { POST } = await importRoute();

    const response = await POST(makeRequest(LINKS_CREATE, "POST", JSON.stringify({ data: {} })), {
      params: Promise.resolve({ path: LINKS_CREATE }),
    });
    expect(response.status).toBe(403);
  });

  it("permite a criação de um link com idPagina da própria página", async () => {
    stubFetch({ $id: "attacker-1" }, { "own-page": "attacker-1", "victim-page": "victim-1" });
    const { POST } = await importRoute();

    const body = JSON.stringify({ data: { idPagina: "own-page", titulo: "meu link", url: "https://me.example" } });
    const response = await POST(makeRequest(LINKS_CREATE, "POST", body), {
      params: Promise.resolve({ path: LINKS_CREATE }),
    });
    // Passa a validação de propriedade; sem Redis o rate limit falha fechado
    // → 503 (nunca 403 de ownership).
    expect(response.status).not.toBe(403);
  });

  it("bloqueia um PUT que tenta mudar idPagina para uma página de terceiros", async () => {
    stubFetch({ $id: "attacker-1" }, { "own-page": "attacker-1", "victim-page": "victim-1" });
    const { PUT } = await importRoute();

    const body = JSON.stringify({ data: { idPagina: "victim-page", titulo: "spam" } });
    const response = await PUT(makeRequest(LINKS_UPDATE, "PUT", body), {
      params: Promise.resolve({ path: LINKS_UPDATE }),
    });
    expect(response.status).toBe(403);
  });

  it("permite atualizar o próprio link sem alterar idPagina", async () => {
    stubFetch({ $id: "attacker-1" }, { "own-page": "attacker-1" });
    const { PUT } = await importRoute();

    const body = JSON.stringify({ data: { titulo: "novo título" } });
    const response = await PUT(makeRequest(LINKS_UPDATE, "PUT", body), {
      params: Promise.resolve({ path: LINKS_UPDATE }),
    });
    expect(response.status).not.toBe(403);
  });

  it("bloqueia a criação de activity_logs com idUtilizador de terceiros", async () => {
    stubFetch({ $id: "attacker-1" }, {});
    const { POST } = await importRoute();

    const body = JSON.stringify({ data: { idUtilizador: "victim-1", acao: "x" } });
    const response = await POST(makeRequest(ACTIVITY_CREATE, "POST", body), {
      params: Promise.resolve({ path: ACTIVITY_CREATE }),
    });
    expect(response.status).toBe(403);
  });

  it("permite a criação de activity_logs com o próprio idUtilizador", async () => {
    stubFetch({ $id: "attacker-1" }, {});
    const { POST } = await importRoute();

    const body = JSON.stringify({ data: { idUtilizador: "attacker-1", acao: "x" } });
    const response = await POST(makeRequest(ACTIVITY_CREATE, "POST", body), {
      params: Promise.resolve({ path: ACTIVITY_CREATE }),
    });
    expect(response.status).not.toBe(403);
  });

  it("permite a criação de uma página com o próprio idUtilizador", async () => {
    stubFetch({ $id: "attacker-1" }, {});
    const { POST } = await importRoute();

    const body = JSON.stringify({ data: { idUtilizador: "attacker-1", nomeUtilizador: "eu" } });
    const response = await POST(makeRequest(PAGES_CREATE, "POST", body), {
      params: Promise.resolve({ path: PAGES_CREATE }),
    });
    expect(response.status).not.toBe(403);
  });

  it("bloqueia a criação de uma página com idUtilizador de terceiros (impersonação)", async () => {
    stubFetch({ $id: "attacker-1" }, {});
    const { POST } = await importRoute();

    const body = JSON.stringify({ data: { idUtilizador: "victim-1", nomeUtilizador: "fake" } });
    const response = await POST(makeRequest(PAGES_CREATE, "POST", body), {
      params: Promise.resolve({ path: PAGES_CREATE }),
    });
    expect(response.status).toBe(403);
  });

  it("GET de documentos continua livre (leitura não é mutação)", async () => {
    stubFetch({ $id: "attacker-1" }, {});
    const { GET } = await importRoute();

    const response = await GET(makeRequest(LINKS_CREATE, "GET"), {
      params: Promise.resolve({ path: LINKS_CREATE }),
    });
    expect(response.status).not.toBe(403);
  });
});
