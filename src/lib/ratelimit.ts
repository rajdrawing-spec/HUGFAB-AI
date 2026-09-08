import 'server-only';

import { env, features } from './env.server';
import { ApiError } from './http';
import { logger } from './logger';

/**
 * Rate limiting. In-memory sliding window locally (single process, resets on
 * restart); Upstash Redis in production, where PM2 may run more than one
 * instance and a per-process counter would be meaningless.
 *
 * Phase 1 endpoints — search, AI, affiliate click-out — attach a limit before
 * they ship. The limiter exists now so that is a one-line change, not a project.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds at which the window resets. */
  reset: number;
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Namespace, so two endpoints sharing an IP do not share a budget. */
  prefix: string;
}

/** Named budgets, so limits are reviewed in one place rather than scattered. */
export const RATE_LIMITS = {
  search: { limit: 60, windowSeconds: 60, prefix: 'rl:search' },
  ai: { limit: 20, windowSeconds: 60, prefix: 'rl:ai' },
  auth: { limit: 10, windowSeconds: 60, prefix: 'rl:auth' },
  affiliateClick: { limit: 120, windowSeconds: 60, prefix: 'rl:click' },
  write: { limit: 30, windowSeconds: 60, prefix: 'rl:write' },
} as const satisfies Record<string, RateLimitRule>;

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function memoryLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    // Opportunistic sweep; the map would otherwise grow with unique IPs.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return {
      success: true,
      limit: rule.limit,
      remaining: rule.limit - 1,
      reset: bucket.resetAt,
    };
  }

  existing.count += 1;
  return {
    success: existing.count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    reset: existing.resetAt,
  };
}

// ---------------------------------------------------------------------------
// Upstash (production)
// ---------------------------------------------------------------------------

type UpstashLimiter = { limit: (key: string) => Promise<RateLimitResult> };

const upstashLimiters = new Map<string, Promise<UpstashLimiter>>();

async function upstashLimiter(rule: RateLimitRule): Promise<UpstashLimiter> {
  // Imported lazily so the Redis client is never pulled into a build that has
  // no Upstash credentials.
  const [{ Redis }, { Ratelimit }] = await Promise.all([
    import('@upstash/redis'),
    import('@upstash/ratelimit'),
  ]);

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL as string,
    token: env.UPSTASH_REDIS_REST_TOKEN as string,
  });

  const limiter = new Ratelimit({
    redis,
    prefix: rule.prefix,
    limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
    analytics: false,
  });

  return {
    async limit(key: string) {
      const result = await limiter.limit(key);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    },
  };
}

// ---------------------------------------------------------------------------

/**
 * Consume one unit of `rule` for `identifier` (an IP, a user id, or both).
 * Never throws: if Redis is unreachable we log and allow the request rather
 * than taking the site down over a rate limiter.
 */
export async function checkRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const key = `${rule.prefix}:${identifier}`;

  if (!features.distributedRateLimit) return memoryLimit(key, rule);

  try {
    let limiter = upstashLimiters.get(rule.prefix);
    if (!limiter) {
      limiter = upstashLimiter(rule);
      upstashLimiters.set(rule.prefix, limiter);
    }
    return await (await limiter).limit(identifier);
  } catch (error) {
    logger.error('rate limiter unavailable, falling back to memory', error, {
      prefix: rule.prefix,
    });
    upstashLimiters.delete(rule.prefix);
    return memoryLimit(key, rule);
  }
}

/** Throws a 429 ApiError when the budget is spent. Use inside a route handler. */
export async function enforceRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const result = await checkRateLimit(identifier, rule);
  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    throw new ApiError('RATE_LIMITED', 'Too many requests. Please slow down.', {
      retryAfter,
    });
  }
  return result;
}

/**
 * Caller identity for rate limiting. Behind Nginx and Cloudflare the socket
 * address is the proxy, so the forwarded headers are the real signal.
 */
export function clientIdentifier(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const headers = request.headers;
  const ip =
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  return `ip:${ip}`;
}

/** For tests, so one case cannot leak state into the next. */
export function __resetRateLimitState(): void {
  buckets.clear();
  upstashLimiters.clear();
}
