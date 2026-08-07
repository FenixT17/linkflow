import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  mergeRateLimitHeaders,
  setRateLimitRedisForTests,
  type RateLimitRedisClient,
} from "@/lib/rate-limit";

describe("distributed rate limiter", () => {
  afterEach(() => {
    setRateLimitRedisForTests(null);
    vi.restoreAllMocks();
  });

  /** Cria um mock stateful que simula fielmente INCR/PEXPIRE/PTTL do Redis. */
  function createRedisMock() {
    const counts = new Map<string, number>();
    const ttls = new Map<string, number>();
    return {
      incr: vi.fn(async (key: string) => {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        // A chave recém-criada NÃO tem TTL até que o PEXPIRE seja chamado.
        if (!ttls.has(key)) ttls.set(key, -1);
        return next;
      }),
      pexpire: vi.fn(async (key: string, ms: number) => {
        ttls.set(key, ms);
        return 1;
      }),
      pttl: vi.fn(async (key: string) => ttls.get(key) ?? -1),
    };
  }

  it("uses basic INCR/PEXPIRE/PTTL commands and preserves shared counts across calls", async () => {
    const redis = createRedisMock();
    const incrCalls: string[] = [];
    const originalIncr = redis.incr;
    redis.incr = vi.fn(async (key: string) => {
      incrCalls.push(key);
      return originalIncr(key);
    });
    setRateLimitRedisForTests(redis);

    const first = await checkRateLimit("login", "198.51.100.10");
    const second = await checkRateLimit("login", "198.51.100.10");

    expect(first).toMatchObject({ allowed: true, remaining: 4, limit: 5 });
    expect(second).toMatchObject({ allowed: true, remaining: 3, limit: 5 });
    expect(incrCalls).toHaveLength(2);
    expect(incrCalls[0]).toMatch(/^linkflow:rate-limit:login:[a-f0-9]{32}$/);
    expect(incrCalls[0]).not.toContain("198.51.100.10");
    expect(redis.pexpire).toHaveBeenCalled();
  });

  it("sets the window expiry on the first request of a window", async () => {
    const redis = createRedisMock();
    setRateLimitRedisForTests(redis);

    const result = await checkRateLimit("login", "198.51.100.99");

    expect(result.allowed).toBe(true);
    // PEXPIRE é chamado porque o PTTL era -1 (chave recém-criada pelo INCR).
    expect(redis.pexpire).toHaveBeenCalledTimes(1);
    expect(redis.pexpire).toHaveBeenLastCalledWith(
      expect.stringMatching(/^linkflow:rate-limit:login:/),
      60_000,
    );
  });

  it("rejects requests after the shared limit is exceeded", async () => {
    setRateLimitRedisForTests({
      incr: vi.fn(async () => 7), // já acima do limite de 5
      pexpire: vi.fn(async () => 1),
      pttl: vi.fn(async () => 12_000),
    });

    const result = await checkRateLimit("login", "198.51.100.11");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it("works with concurrent calls through the same distributed adapter", async () => {
    let count = 0;
    const redis: RateLimitRedisClient = {
      incr: vi.fn(async () => {
        count += 1;
        return count;
      }),
      pexpire: vi.fn(async () => 1),
      pttl: vi.fn(async () => 30_000),
    };
    setRateLimitRedisForTests(redis);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => checkRateLimit("view", "198.51.100.12", {
        maxRequests: 5,
        windowMs: 30_000,
      })),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(3);
  });

  it("returns standard rate-limit response headers", () => {
    const headers = mergeRateLimitHeaders({ "Content-Type": "application/json" }, {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 15_000,
      limit: 10,
    });

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-RateLimit-Limit")).toBe("10");
    expect(headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(headers.get("Retry-After")).toBeTruthy();
  });

  it("accepts only trusted single IP headers and ignores spoofable legacy headers", () => {
    expect(getClientIp(new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "203.0.113.1",
      },
    }))).toBe("unknown");

    expect(getClientIp(new Request("https://example.test", {
      headers: {
        "cf-connecting-ip": "203.0.113.2",
      },
    }))).toBe("203.0.113.2");

    // IPv6 legítimos (incluindo formas curtas e zona) devem ser aceites
    expect(getClientIp(new Request("https://example.test", {
      headers: { "cf-connecting-ip": "::1" },
    }))).toBe("::1");
    expect(getClientIp(new Request("https://example.test", {
      headers: { "cf-connecting-ip": "fe80::1" },
    }))).toBe("fe80::1");
    expect(getClientIp(new Request("https://example.test", {
      headers: { "cf-connecting-ip": "2001:db8::1" },
    }))).toBe("2001:db8::1");

    // Múltiplos IPs (vírgula) continuam rejeitados — CR/LF nem chegam a
    // existir num header: a própria Fetch API rejeita esse valor.
    expect(getClientIp(new Request("https://example.test", {
      headers: { "cf-connecting-ip": "203.0.113.1, 198.51.100.2" },
    }))).toBe("unknown");
  });

  it("fails closed when Upstash credentials are not configured", async () => {
    setRateLimitRedisForTests(null);
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    await expect(checkRateLimit("login", "198.51.100.13")).rejects.toThrow(/Upstash Redis is not configured/);

    if (url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = url;
    if (token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = token;
  });
});
