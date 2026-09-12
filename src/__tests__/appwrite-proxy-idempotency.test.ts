import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Idempotência da criação de links no proxy /api/appwrite.
 *
 * Bug original: um duplo clique (ou dois pedidos concorrentes/duplicados da
 * mesma intenção) gerava dois `createDocument` no Appwrite → dois links
 * iguais. O frontend passou a bloquear cliques repetidos, mas o backend é a
 * camada definitiva: com uma `Idempotency-Key` por intenção, exatamente um
 * pedido cria o documento e os restantes recebem o resultado guardado.
 *
 * Estes testes cobrem concorrência real (promessas simultâneas), replay
 * sequencial, chaves distintas (links legitimamente semelhantes), falha do
 * upstream e indisponibilidade do Redis.
 */
describe("appwrite proxy idempotent creates", () => {
  beforeEach(() => {
    vi.resetModules();
  });

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
   * Redis stateful que serve tanto o rate limit (INCR/PEXPIRE/PTTL) como a
   * idempotência (SET NX/GET/DEL), com semântica fiel ao Redis:
   * `SET ... NX` só escreve se a chave não existir.
   */
  function createRedisMock() {
    const store = new Map<string, string>();
    const counters = new Map<string, number>();
    return {
      store,
      incr: vi.fn(async (key: string) => {
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return next;
      }),
      pexpire: vi.fn(async () => 1),
      pttl: vi.fn(async () => 60_000),
      set: vi.fn(async (key: string, value: string, options?: { nx?: boolean; ex?: number }) => {
        if (options?.nx && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      }),
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    };
  }

  const LINK_PATH = ["databases", "db", "collections", "links", "documents"];
  const LINK_BODY = {
    data: { idPagina: "own-page", titulo: "Instagram", url: "https://instagram.com/exemplo" },
  };

  interface FetchStats {
    creates: number;
  }

  /**
   * Mock do upstream: validações (conta, dono da página, plano) + a criação
   * real. As respostas de criação são consumidas por ordem, para simular
   * falha seguida de sucesso.
   */
  function stubFetch(createResponses: Array<() => Response>, stats: FetchStats) {
    let index = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/account")) return jsonResponse(200, { $id: "user-1" });
        if (/\/collections\/pages\/documents\//.test(url)) {
          return jsonResponse(200, { idUtilizador: "user-1" });
        }
        if (url.includes("/collections/users/documents")) {
          // Plano pago → o limite de links do plano free não interfere.
          return jsonResponse(200, { total: 1, documents: [{ plano: "pro" }] });
        }
        if (url.includes("/collections/links/documents") && url.includes("queries")) {
          return jsonResponse(200, { total: 0, documents: [] });
        }
        if (url.includes("/collections/links/documents")) {
          stats.creates += 1;
          const factory = createResponses[Math.min(index, createResponses.length - 1)];
          index += 1;
          return factory();
        }
        return jsonResponse(201, { $id: "created" });
      })
    );
  }

  async function importRouteWith(redis: ReturnType<typeof createRedisMock>) {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    const idempotency = await import("@/lib/idempotency.server");
    const rateLimit = await import("@/lib/rate-limit");
    idempotency.setIdempotencyRedisForTests(redis);
    rateLimit.setRateLimitRedisForTests(redis);
    return import("@/app/api/appwrite/[...path]/route");
  }

  function makeRequest(idempotencyKey?: string) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-csrf-token": "valid-token",
    };
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const request = new NextRequest(
      "https://example.com/api/appwrite/databases/db/collections/links/documents",
      { method: "POST", headers, body: JSON.stringify(LINK_BODY) }
    );
    request.cookies.set("csrf-token", "valid-token");
    request.cookies.set("linkflow-session", "session-1");
    return request;
  }

  const context = { params: Promise.resolve({ path: LINK_PATH }) };
  const KEY_A = "11111111-2222-3333-4444-555555555555";
  const KEY_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("duas requisições concorrentes com a mesma chave criam um único link", async () => {
    const redis = createRedisMock();
    const stats: FetchStats = { creates: 0 };
    stubFetch([() => jsonResponse(201, { $id: "link-1", titulo: "Instagram" })], stats);
    const { POST } = await importRouteWith(redis);

    const [first, second] = await Promise.all([
      POST(makeRequest(KEY_A), context),
      POST(makeRequest(KEY_A), context),
    ]);

    // Exatamente uma criação no Appwrite, apesar de dois pedidos.
    expect(stats.creates).toBe(1);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);
    expect(firstBody.$id).toBe("link-1");
    // O pedido duplicado recebe o MESMO resultado (não cria outro link).
    expect(secondBody.$id).toBe("link-1");
    expect(second.headers.get("X-Idempotency-Replay")).toBe("true");
  });

  it("reenviar a mesma chave depois de concluída devolve o resultado sem criar de novo", async () => {
    const redis = createRedisMock();
    const stats: FetchStats = { creates: 0 };
    stubFetch([() => jsonResponse(201, { $id: "link-1", titulo: "Instagram" })], stats);
    const { POST } = await importRouteWith(redis);

    const first = await POST(makeRequest(KEY_A), context);
    const replay = await POST(makeRequest(KEY_A), context);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotency-Replay")).toBe("true");
    expect((await replay.json()).$id).toBe("link-1");
    expect(stats.creates).toBe(1);
  });

  it("chaves diferentes criam links distintos mesmo com os mesmos dados", async () => {
    const redis = createRedisMock();
    const stats: FetchStats = { creates: 0 };
    stubFetch([() => jsonResponse(201, { $id: "link-1" }), () => jsonResponse(201, { $id: "link-2" })], stats);
    const { POST } = await importRouteWith(redis);

    const first = await POST(makeRequest(KEY_A), context);
    const second = await POST(makeRequest(KEY_B), context);

    // Duas INTENÇÕES diferentes → dois links (mesma URL é permitida).
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await first.json()).$id).toBe("link-1");
    expect((await second.json()).$id).toBe("link-2");
    expect(stats.creates).toBe(2);
  });

  it("sem Idempotency-Key mantém o comportamento normal (uma criação por pedido)", async () => {
    const redis = createRedisMock();
    const stats: FetchStats = { creates: 0 };
    stubFetch([() => jsonResponse(201, { $id: "link-1" })], stats);
    const { POST } = await importRouteWith(redis);

    await POST(makeRequest(), context);
    await POST(makeRequest(), context);

    expect(stats.creates).toBe(2);
  });

  it("ignora chaves com formato inválido", async () => {
    const redis = createRedisMock();
    const stats: FetchStats = { creates: 0 };
    stubFetch([() => jsonResponse(201, { $id: "link-1" })], stats);
    const { POST } = await importRouteWith(redis);

    await POST(makeRequest("curta"), context);
    await POST(makeRequest("curta"), context);

    expect(stats.creates).toBe(2);
    // Nenhuma chave inválida deve ter sido reservada no Redis.
    expect([...redis.store.keys()].some((key) => key.includes("linkflow:idempotency"))).toBe(false);
  });

  it("liberta a chave quando a criação falha, permitindo nova tentativa", async () => {
    const redis = createRedisMock();
    const stats: FetchStats = { creates: 0 };
    stubFetch(
      [() => jsonResponse(500, { message: "boom" }), () => jsonResponse(201, { $id: "link-1" })],
      stats
    );
    const { POST } = await importRouteWith(redis);

    const failed = await POST(makeRequest(KEY_A), context);
    expect(failed.status).toBe(500);

    // O cliente reutiliza a MESMA chave no retry (mesma intenção).
    const retry = await POST(makeRequest(KEY_A), context);
    expect(retry.status).toBe(201);
    expect((await retry.json()).$id).toBe("link-1");
    expect(stats.creates).toBe(2);
  });

  it("segue sem idempotência se o Redis falhar (fail-open)", async () => {
    const redis = createRedisMock();
    redis.set = vi.fn(async () => {
      throw new Error("redis down");
    });
    const stats: FetchStats = { creates: 0 };
    stubFetch([() => jsonResponse(201, { $id: "link-1" })], stats);
    const { POST } = await importRouteWith(redis);

    const response = await POST(makeRequest(KEY_A), context);

    // A criação nunca é bloqueada por indisponibilidade do Redis.
    expect(response.status).toBe(201);
    expect(stats.creates).toBe(1);
  });

  it("não encaminha o header interno Idempotency-Key para o upstream", async () => {
    const redis = createRedisMock();
    const stats: FetchStats = { creates: 0 };
    const seenHeaders: Headers[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/account")) return jsonResponse(200, { $id: "user-1" });
        if (/\/collections\/pages\/documents\//.test(url)) {
          return jsonResponse(200, { idUtilizador: "user-1" });
        }
        if (url.includes("/collections/users/documents")) {
          return jsonResponse(200, { total: 1, documents: [{ plano: "pro" }] });
        }
        if (url.includes("/collections/links/documents") && url.includes("queries")) {
          return jsonResponse(200, { total: 0, documents: [] });
        }
        if (url.includes("/collections/links/documents")) {
          stats.creates += 1;
          seenHeaders.push(new Headers(init?.headers as HeadersInit));
          return jsonResponse(201, { $id: "link-1" });
        }
        return jsonResponse(201, { $id: "created" });
      })
    );
    const { POST } = await importRouteWith(redis);

    await POST(makeRequest(KEY_A), context);

    expect(seenHeaders.length).toBe(1);
    expect(seenHeaders[0].has("idempotency-key")).toBe(false);
    expect(seenHeaders[0].get("x-appwrite-session")).toBe("session-1");
  });
});
