/**
 * Edge-compatible in-memory sliding-window rate limiter for Next.js middleware and API routes.
 * Operates with zero native external dependencies and is safe for Edge runtime and Node.js runtime.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  limit: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number; // Milliseconds timestamp
}

// Global in-memory storage for rate limits
const rateLimitStore = new Map<string, RateLimitEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Periodically purge expired rate limit entries to prevent memory growth.
 */
function cleanupExpiredEntries(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Checks rate limit for a given identifier (e.g. IP or User ID) and category.
 *
 * @param identifier Client IP address or User identifier
 * @param category Route or action category (e.g. "auth", "order")
 * @param limit Maximum allowed requests within the time window
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkEdgeRateLimit(
  identifier: string,
  category: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const cleanIdentifier = identifier.trim() || "unknown";
  const key = `${category}:${cleanIdentifier}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    // Window expired or new entry
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      reset: Math.ceil(resetAt / 1000),
      limit,
    };
  }

  // Window active: increment counter
  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const reset = Math.ceil(entry.resetAt / 1000);

  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      reset,
      limit,
    };
  }

  return {
    allowed: true,
    remaining,
    reset,
    limit,
  };
}

/**
 * Extracts the real client IP from incoming request headers, supporting Cloudflare and reverse proxies.
 */
export function extractClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

/**
 * Clears in-memory storage (useful for unit testing).
 */
export function resetEdgeRateLimiter(): void {
  rateLimitStore.clear();
  lastCleanup = Date.now();
}
