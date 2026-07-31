/**
 * Rate limiting — in-memory sliding window per IP + action.
 *
 * Uses a Map with TTL cleanup. Suitable for serverless Edge Runtime.
 * For multi-instance production, consider Upstash Redis, but for
 * single-instance deployments this is sufficient and has zero deps.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Maximum number of entries to prevent memory exhaustion attacks
const MAX_STORE_SIZE = 10_000;

// Cleanup expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
  // Force cleanup if store is still too large (aggressive LRU)
  if (store.size > MAX_STORE_SIZE) {
    const entries = Array.from(store.entries())
      .sort((a, b) => a[1].resetTime - b[1].resetTime);
    const toRemove = entries.slice(0, entries.length - MAX_STORE_SIZE + 1000);
    for (const [key] of toRemove) {
      store.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** Preset rate limits for different actions */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxRequests: 5, windowMs: 60 * 1000 },        // 5/min
  register: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3/hour
  passwordReset: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3/hour
  captcha: { maxRequests: 10, windowMs: 60 * 1000 },     // 10/min
  api: { maxRequests: 30, windowMs: 60 * 1000 },         // 30/min generic
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Check rate limit for a given action + IP.
 * Returns { allowed, remaining, resetTime }.
 */
export function checkRateLimit(
  action: string,
  ip: string,
  config?: RateLimitConfig
): RateLimitResult {
  cleanup();

  const limit = config ?? RATE_LIMITS[action] ?? RATE_LIMITS.api;
  const key = `${action}:${ip}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    store.set(key, { count: 1, resetTime: now + limit.windowMs });
    return { allowed: true, remaining: limit.maxRequests - 1, resetTime: now + limit.windowMs };
  }

  entry.count++;

  if (entry.count > limit.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  return { allowed: true, remaining: limit.maxRequests - entry.count, resetTime: entry.resetTime };
}

/**
 * Get client IP from Next.js request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
