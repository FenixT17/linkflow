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

  it("uses an atomic Redis script and preserves shared counts across calls", async () => {
    const calls: Array<{ script: string; keys: string[]; args: unknown[] }> = [];
    let count = 0;
    const evalMock = vi.fn(async (script: string, keys: string[], args: unknown[]) => {
      calls.push({ script, keys, args });
      count += 1;
      return [count, 59_500] as [number, number];
    }) as unknown as RateLimitRedisClient["eval"];
    const redis: RateLimitRedisClient = { eval: evalMock };
    setRateLimitRedisForTests(redis);

    const first = await checkRateLimit("login", "198.51.100.10");
    const second = await checkRateLimit("login", "198.51.100.10");

    expect(first).toMatchObject({ allowed: true, remaining: 4, limit: 5 });
    expect(second).toMatchObject({ allowed: true, remaining: 3, limit: 5 });
    expect(calls).toHaveLength(2);
    expect(calls[0].keys[0]).toMatch(/^linkflow:rate-limit:login:[a-f0-9]{32}$/);
    expect(calls[0].keys[0]).not.toContain("198.51.100.10");
    expect(calls[0].script).toContain("PEXPIRE");
    expect(calls[0].args).toEqual(["60000"]);
  });

  it("rejects requests after the shared limit is exceeded", async () => {
    const evalMock = vi.fn(async () => [6, 12_000] as [number, number]) as unknown as RateLimitRedisClient["eval"];
    setRateLimitRedisForTests({ eval: evalMock });

    const result = await checkRateLimit("login", "198.51.100.11");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it("works with concurrent calls through the same distributed adapter", async () => {
    let count = 0;
    const evalMock = vi.fn(async () => {
      count += 1;
      return [count, 30_000] as [number, number];
    }) as unknown as RateLimitRedisClient["eval"];
    setRateLimitRedisForTests({ eval: evalMock });

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
