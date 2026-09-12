import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CSRF_COOKIE_NAME, csrfGuard } from "@/lib/csrf";

/**
 * O proxy /api/appwrite aceita mutações (POST/PUT/PATCH/DELETE) que encaminham
 * o client SDK do browser para o Appwrite. Como o proxy injeta a sessão
 * HttpOnly server-side, um site malicioso poderia induzir o browser a fazer
 * mutações cross-site (ex: criar documentos) se o proxy não validasse CSRF.
 *
 * Estes testes verificam que o proxy aplica o csrfGuard a mutações e ignora
 * leituras (GET). O token é enviado pelo client SDK (src/lib/appwrite.ts).
 *
 * IMPORTANTE — porque é que o ambiente é isolado:
 * O build do Netlify corre `next build` com UPSTASH_* e APPWRITE_API_KEY
 * injetados. Sem isolar, um pedido que passa o CSRF continua para o rate limit
 * (Redis real, que responde) e daí para o Appwrite real, cujo 403 do upstream é
 * reenviado sem alterações — e as asserções `not.toBe(403)` passavam a receber
 * exatamente 403, falhando o build. Localmente o mesmo teste passava porque sem
 * UPSTASH_* o rate limit falha fechado (503). Era um teste dependente do
 * ambiente, não do comportamento.
 *
 * Por isso: `@/lib/rate-limit` é mockado (aqui testa-se CSRF, não quota) e o
 * `fetch` é stubado, como já fazem os testes do proxy de ownership.
 */

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({
    allowed: true,
    remaining: 119,
    resetTime: Date.now() + 60_000,
    limit: 120,
  }),
  getClientIp: () => "203.0.113.1",
  mergeRateLimitHeaders: () => ({}),
}));

describe("appwrite proxy CSRF", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const PATH = ["databases", "db", "collections", "links", "documents"];

  /** Fetch upstream stubado: nada sai para a rede. */
  function stubUpstream() {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ total: 0, documents: [], $id: "created" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    return calls;
  }

  async function importRoute() {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    return import("@/app/api/appwrite/[...path]/route");
  }

  function makeRequest(
    options: { method?: string; body?: string } = {},
    csrf?: { cookie: string; header: string },
  ) {
    const method = options.method ?? "POST";
    // GET/HEAD não podem levar body (o NextRequest lança) — o proxy também não
    // lê nada de um GET.
    const withBody = method !== "GET" && method !== "HEAD";
    const request = new NextRequest(`https://example.com/api/appwrite/${PATH.join("/")}`, {
      method,
      ...(withBody ? { body: options.body ?? "{}" } : {}),
    });
    if (csrf) {
      // O nome do cookie vem do módulo (não é o literal "csrf-token"): em
      // NODE_ENV=production chama-se __Host-linkflow-csrf, e um teste que
      // fixasse o nome só passaria em dev.
      request.cookies.set(CSRF_COOKIE_NAME, csrf.cookie);
      request.headers.set("x-csrf-token", csrf.header);
    }
    return request;
  }

  it("rejects a POST without a CSRF token with 403", async () => {
    const upstreamCalls = stubUpstream();
    const { POST } = await importRoute();

    const response = await POST(makeRequest(), { params: Promise.resolve({ path: PATH }) });

    expect(response.status).toBe(403);
    // Rejeitado ANTES de gastar um pedido ao Appwrite.
    expect(upstreamCalls).toHaveLength(0);
  });

  it("rejects a POST when the CSRF header does not match the cookie", async () => {
    const upstreamCalls = stubUpstream();
    const { POST } = await importRoute();

    const response = await POST(
      makeRequest({}, { cookie: "legit-token", header: "attacker-token" }),
      { params: Promise.resolve({ path: PATH }) },
    );

    expect(response.status).toBe(403);
    expect(upstreamCalls).toHaveLength(0);
  });

  it("accepts a POST with a matching CSRF token (passes the guard)", async () => {
    const upstreamCalls = stubUpstream();
    const { POST } = await importRoute();

    const response = await POST(
      makeRequest({}, { cookie: "valid-token", header: "valid-token" }),
      { params: Promise.resolve({ path: PATH }) },
    );

    // Passou o CSRF e foi mesmo encaminhado para o Appwrite (não é um 403).
    expect(response.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);
    expect(upstreamCalls[0]).toContain("/collections/links/documents");
  });

  it("allows GET requests without a CSRF token (reads are not blocked)", async () => {
    const upstreamCalls = stubUpstream();
    const { GET } = await importRoute();

    const response = await GET(makeRequest({ method: "GET" }), {
      params: Promise.resolve({ path: PATH }),
    });

    expect(response.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);
  });
});

describe("csrfGuard — contrato do guard", () => {
  /**
   * Os testes do proxy acima só exercitam GET e POST. O guard tem de ignorar
   * TODAS as leituras, e é aqui que HEAD e OPTIONS (que o proxy nem aceita)
   * ficam documentados.
   */
  function requestFor(method: string, csrf?: { cookie: string; header: string }) {
    const request = new NextRequest("https://example.com/api/appwrite", { method });
    if (csrf) {
      request.cookies.set(CSRF_COOKIE_NAME, csrf.cookie);
      request.headers.set("x-csrf-token", csrf.header);
    }
    return request;
  }

  it("não bloqueia leituras (GET, HEAD, OPTIONS)", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(csrfGuard(requestFor(method)), method).toBeNull();
    }
  });

  it("bloqueia mutações sem token ou com token divergente", () => {
    expect(csrfGuard(requestFor("POST"))?.status).toBe(403);
    expect(csrfGuard(requestFor("DELETE"))?.status).toBe(403);
    expect(
      csrfGuard(requestFor("PUT", { cookie: "a", header: "b" }))?.status,
    ).toBe(403);
  });

  it("aceita mutações com o token do cookie reproduzido no header", () => {
    expect(csrfGuard(requestFor("POST", { cookie: "tok", header: "tok" }))).toBeNull();
    expect(csrfGuard(requestFor("PATCH", { cookie: "tok", header: "tok" }))).toBeNull();
  });
});
