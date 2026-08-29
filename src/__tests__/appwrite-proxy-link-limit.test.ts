import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * O limite de links do plano gratuito é imposto server-side no proxy
 * /api/appwrite (a coleção links tem create: Role.users() e o client SDK
 * pode ser contornado chamando o proxy diretamente). O client mantém um
 * check apenas para UX — o enforcement real é este, fail-closed.
 */
describe("appwrite proxy free plan link limit", () => {
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

  interface FetchScenario {
    plan: string | null; // null = falha ao ler o plano
    linkTotal: number | null; // null = falha ao contar links
  }

  function stubFetch({ plan, linkTotal }: FetchScenario) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/account")) {
          return jsonResponse(200, { $id: "user-1" });
        }
        const pageMatch = url.match(/\/collections\/pages\/documents\/([^/?#]+)/);
        if (pageMatch) {
          return jsonResponse(200, { idUtilizador: "user-1" });
        }
        if (url.includes("/collections/users/documents")) {
          if (plan === null) return jsonResponse(500, { message: "boom" });
          return jsonResponse(200, { total: 1, documents: [{ plano: plan }] });
        }
        if (url.includes("/collections/links/documents") && url.includes("queries")) {
          if (linkTotal === null) return jsonResponse(500, { message: "boom" });
          return jsonResponse(200, { total: linkTotal, documents: [] });
        }
        // Pedido encaminhado (o create real) — não deve ser alcançado quando
        // a validação rejeita. O mock devolve 201 para os casos permitidos.
        return jsonResponse(201, { $id: "created" });
      })
    );
  }

  async function importRoute() {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    return import("@/app/api/appwrite/[...path]/route");
  }

  function makeCreateLinkRequest(body: string) {
    const path = ["databases", "db", "collections", "links", "documents"];
    const request = new NextRequest("https://example.com/api/appwrite/databases/db/collections/links/documents", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "valid-token" },
      body,
    });
    request.cookies.set("csrf-token", "valid-token");
    request.cookies.set("linkflow-session", "session-1");
    return { request, path };
  }

  it("bloqueia o 4º link de um utilizador free (3 já existem)", async () => {
    stubFetch({ plan: "free", linkTotal: 3 });
    const { POST } = await importRoute();

    const { request, path } = makeCreateLinkRequest(
      JSON.stringify({ data: { idPagina: "own-page", titulo: "spam", url: "https://evil.example" } })
    );
    const response = await POST(request, { params: Promise.resolve({ path }) });
    expect(response.status).toBe(403);
    // O proxy devolve erros no formato nativo do Appwrite ({ message }) para
    // o SDK do browser os expor como error.message limpo no dashboard.
    const body = (await response.json()) as { message?: string };
    expect(body.message).toContain("Limite de links do plano Gratuito");
  });

  it("permite o 3º link de um utilizador free (2 existem)", async () => {
    stubFetch({ plan: "free", linkTotal: 2 });
    const { POST } = await importRoute();

    const { request, path } = makeCreateLinkRequest(
      JSON.stringify({ data: { idPagina: "own-page", titulo: "link", url: "https://me.example" } })
    );
    const response = await POST(request, { params: Promise.resolve({ path }) });
    // Passa a validação; sem Redis o rate limit falha fechado → 503 (nunca 403).
    expect(response.status).not.toBe(403);
  });

  it("não aplica o limite a utilizadores de planos pagos", async () => {
    stubFetch({ plan: "pro", linkTotal: 5 });
    const { POST } = await importRoute();

    const { request, path } = makeCreateLinkRequest(
      JSON.stringify({ data: { idPagina: "own-page", titulo: "link", url: "https://me.example" } })
    );
    const response = await POST(request, { params: Promise.resolve({ path }) });
    expect(response.status).not.toBe(403);
  });

  it("falha fechado quando não é possível verificar o plano (assume free)", async () => {
    stubFetch({ plan: null, linkTotal: 3 });
    const { POST } = await importRoute();

    const { request, path } = makeCreateLinkRequest(
      JSON.stringify({ data: { idPagina: "own-page", titulo: "spam", url: "https://evil.example" } })
    );
    const response = await POST(request, { params: Promise.resolve({ path }) });
    expect(response.status).toBe(403);
  });

  it("falha fechado quando não é possível contar os links", async () => {
    stubFetch({ plan: "free", linkTotal: null });
    const { POST } = await importRoute();

    const { request, path } = makeCreateLinkRequest(
      JSON.stringify({ data: { idPagina: "own-page", titulo: "spam", url: "https://evil.example" } })
    );
    const response = await POST(request, { params: Promise.resolve({ path }) });
    expect(response.status).toBe(403);
  });
});
