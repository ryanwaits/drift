interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter store
 * Can be swapped for Redis in production
 */
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const existing = this.get(key);

    if (existing) {
      existing.count++;
      return existing;
    }

    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    this.store.set(key, entry);
    return entry;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

const store = new RateLimitStore();

// Cleanup expired entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => store.cleanup(), 60 * 1000).unref?.();
}

export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window */
  max: number;
  /** Optional key prefix */
  prefix?: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Check common proxy headers
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Vercel-specific
  const vercelIp = headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  return 'unknown';
}

/**
 * Check rate limit for a request
 * Returns result with ok=true if under limit, ok=false if rate limited
 */
export function checkRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const { windowMs, max, prefix = 'ratelimit' } = options;
  const ip = getClientIp(request);
  const key = `${prefix}:${ip}`;

  const entry = store.increment(key, windowMs);

  return {
    ok: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    limit: max,
    resetAt: entry.resetAt,
  };
}

/**
 * Add rate limit headers to a Response
 */
export function withRateLimitHeaders(response: Response, result: RateLimitResult): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
