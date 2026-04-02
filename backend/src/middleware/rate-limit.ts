import type { MiddlewareHandler } from "hono";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory store: key → { count, windowStart }
const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    // Remove entries that are older than 10 minutes
    if (now - entry.windowStart > 10 * 60 * 1000) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates a sliding-window rate limiter middleware.
 *
 * @param max      - Max requests allowed per window
 * @param windowMs - Window duration in milliseconds
 * @param keyFn    - Optional function to derive the rate-limit key from the request
 */
export function rateLimit(
  max: number,
  windowMs: number,
  keyFn?: (c: Parameters<MiddlewareHandler>[0]) => string
): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    const path = new URL(c.req.url).pathname;
    const key = keyFn ? keyFn(c) : `${ip}:${path}`;

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      // Start a new window
      store.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", "0");
      return c.json(
        { error: "Too many requests. Please try again later." },
        429
      );
    }

    entry.count++;
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(max - entry.count));
    return next();
  };
}

/** Strict limiter for auth endpoints: 10 requests per minute per IP */
export const authRateLimit = rateLimit(10, 60 * 1000);

/** Limiter for payment creation: 30 requests per minute per IP */
export const paymentRateLimit = rateLimit(30, 60 * 1000);

/** Limiter for notification sending: 60 requests per minute per IP */
export const notificationRateLimit = rateLimit(60, 60 * 1000);

/** Weather API limiter: 30 requests per minute per IP */
export const weatherRateLimit = rateLimit(30, 60 * 1000);

/** General API limiter: 200 requests per minute per IP */
export const generalRateLimit = rateLimit(200, 60 * 1000);
