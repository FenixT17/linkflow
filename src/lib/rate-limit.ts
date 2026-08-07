import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  /** Número máximo de pedidos no período. */
  maxRequests: number;
  /** Duração da janela em milissegundos. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/** Limites configuráveis por ambiente, com defaults conservadores. */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: {
    maxRequests: 5,
    windowMs: 60_000,
  },
  register: {
    maxRequests: 3,
    windowMs: 3_600_000,
  },
  passwordReset: {
    maxRequests: 3,
    windowMs: 3_600_000,
  },
  captcha: {
    maxRequests: 10,
    windowMs: 60_000,
  },
  api: {
    maxRequests: 30,
    windowMs: 60_000,
  },
};

const RATE_LIMIT_PREFIX = "linkflow:rate-limit";
const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

export interface RateLimitRedisClient {
  eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData>;
}

let redisClient: RateLimitRedisClient | null = null;

function getRedis(): RateLimitRedisClient {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) {
      throw new Error("Upstash Redis is not configured. Define UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    }
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

function normalizeConfig(config: RateLimitConfig): RateLimitConfig {
  if (!Number.isSafeInteger(config.maxRequests) || config.maxRequests < 1) {
    throw new Error("Rate limit maxRequests must be a positive integer.");
  }
  if (!Number.isSafeInteger(config.windowMs) || config.windowMs < 1) {
    throw new Error("Rate limit windowMs must be a positive integer.");
  }
  return config;
}

/**
 * Identificador de cliente fornecido pela infraestrutura Cloudflare.
 * Não aceita X-Forwarded-For/X-Real-IP arbitrariamente enviados pelo cliente.
 * O header único aceite é cf-connecting-ip, que é injetado pelo Cloudflare e
 * não pode ser falsificado pelo cliente; quando ausente, usa uma chave
 * conservadora `unknown`.
 */
export function getClientIp(request: Request): string {
  const trustedHeaders = ["cf-connecting-ip"];
  for (const header of trustedHeaders) {
    const value = request.headers.get(header)?.trim();
    if (value && isPlausibleIp(value)) return value;
  }
  return "unknown";
}

/**
 * Validação local de IPv4/IPv6 (substitui `node:net` `isIP`, que não está
 * disponível de forma fiável no runtime workerd do Cloudflare). A regex IPv6
 * é a padrão do is-ip (cobre ::1, fe80::1%zone, formas comprimidas).
 */
function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

const IPV6_SEGMENT = "[0-9a-fA-F]{1,4}";
const IPV6_RE = new RegExp(
  "^(" +
    `(?:${IPV6_SEGMENT}:){7}${IPV6_SEGMENT}|` + // 1:2:3:4:5:6:7:8
    `(?:${IPV6_SEGMENT}:){1,7}:|` + // 1:: / 1:2:3:4:5:6:7::
    `(?:${IPV6_SEGMENT}:){1,6}:${IPV6_SEGMENT}|` + // 1::8
    `(?:${IPV6_SEGMENT}:){1,5}(?::${IPV6_SEGMENT}){1,2}|` +
    `(?:${IPV6_SEGMENT}:){1,4}(?::${IPV6_SEGMENT}){1,3}|` +
    `(?:${IPV6_SEGMENT}:){1,3}(?::${IPV6_SEGMENT}){1,4}|` +
    `(?:${IPV6_SEGMENT}:){1,2}(?::${IPV6_SEGMENT}){1,5}|` +
    `${IPV6_SEGMENT}:(?:(?::${IPV6_SEGMENT}){1,6})|` +
    `:(?:(?::${IPV6_SEGMENT}){1,7}|:)|` + // ::1 / ::
    `fe80:(?::${IPV6_SEGMENT}){0,4}%[0-9a-zA-Z]+` + // fe80::1%eth0
  ")$"
);

function isIpv6(value: string): boolean {
  if (value.length < 2 || value.length > 64 || !value.includes(":")) return false;
  return IPV6_RE.test(value);
}

function isPlausibleIp(value: string): boolean {
  if (value.length > 64 || /[\r\n,]/.test(value)) return false;
  return isIpv4(value) || isIpv6(value);
}

function safeAction(action: string): string {
  return action.trim().toLowerCase().replace(/[^a-z0-9:_-]/g, "_").slice(0, 80) || "api";
}

function hashIdentifier(identifier: string): string {
  return createHash("sha256")
    .update(identifier.trim() || "unknown", "utf8")
    .digest("hex")
    .slice(0, 32);
}

/**
 * Verifica um limite com uma operação Lua atómica no Redis.
 * O contador e a expiração vivem no Upstash, logo são partilhados por
 * instâncias serverless, cold starts e regiões diferentes.
 */
export async function checkRateLimit(
  action: string,
  identifier: string,
  config?: RateLimitConfig,
): Promise<RateLimitResult> {
  const limit = normalizeConfig(config ?? RATE_LIMITS[action] ?? RATE_LIMITS.api);
  const key = `${RATE_LIMIT_PREFIX}:${safeAction(action)}:${hashIdentifier(identifier)}`;
  const result = await getRedis().eval<
    [string],
    [number | string, number | string]
  >(
    RATE_LIMIT_SCRIPT,
    [key],
    [String(limit.windowMs)],
  );

  const count = Number(result?.[0]);
  const ttl = Math.max(Number(result?.[1]), 1);
  if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
    throw new Error("Invalid response from Upstash rate limiter.");
  }

  return {
    allowed: count <= limit.maxRequests,
    remaining: Math.max(limit.maxRequests - count, 0),
    resetTime: Date.now() + ttl,
    limit: limit.maxRequests,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetTime / 1000)));
  if (!result.allowed) {
    headers.set("Retry-After", String(Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000))));
  }
  return headers;
}

export function mergeRateLimitHeaders(
  headers: HeadersInit | undefined,
  result: RateLimitResult,
): Headers {
  const merged = new Headers(headers);
  const limitHeaders = rateLimitHeaders(result);
  limitHeaders.forEach((value, key) => merged.set(key, value));
  return merged;
}

/** Injeta um cliente fake nos testes sem tocar no Redis real. */
export function setRateLimitRedisForTests(client: RateLimitRedisClient | null): void {
  redisClient = client;
}
