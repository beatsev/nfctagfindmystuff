import type { MiddlewareHandler } from 'hono';

// In-memory rate limiting (simple MVP implementation)
// For production, consider using KV-based rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter
 * @param maxRequests - Maximum number of requests allowed
 * @param windowSeconds - Time window in seconds
 * @returns Hono middleware handler
 */
export function rateLimitMiddleware(
  maxRequests: number,
  windowSeconds: number
): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const path = c.req.path;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Create unique key per IP + path
    const key = `${ip}:${path}`;
    const record = requestCounts.get(key);

    if (!record || now > record.resetAt) {
      // First request or window expired - reset counter
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      // Increment counter
      record.count++;

      if (record.count > maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return c.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            retryAfter
          },
          429,
          {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': record.resetAt.toString(),
          }
        );
      }
    }

    // Add rate limit headers
    const remaining = maxRequests - (record?.count || 1);
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, remaining).toString());
    c.header('X-RateLimit-Reset', (record?.resetAt || (now + windowMs)).toString());

    // Cleanup old entries on each request to prevent memory leaks
    // (runs at most once per request, lightweight operation)
    for (const [k, r] of requestCounts.entries()) {
      if (now > r.resetAt + 60000) { // Clean up 1 minute after expiry
        requestCounts.delete(k);
      }
    }

    await next();
  };
}
