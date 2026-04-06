import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { createRateLimiter } from '@/lib/rate-limit'

/**
 * Upstash Redis client. Returns null when credentials are not configured,
 * allowing the app to fall back to in-memory implementations in development.
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production.
 * The free tier (10k requests/day) is sufficient for rate limiting.
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export const redis = createRedisClient()

/**
 * Create a rate limiter backed by Upstash Redis when available, or falling
 * back to the in-memory limiter for development.
 *
 * The Upstash sliding window limiter works across all server instances and
 * survives redeploys — critical for production rate limiting on Vercel
 * (which auto-scales to multiple instances).
 */
export interface RateLimitCheckResult {
  ok: boolean
  remaining: number
  resetMs: number
}

export function createUpstashRateLimiter(opts: {
  prefix: string
  maxRequests: number
  windowMs: number
}): {
  check: (key: string) => Promise<RateLimitCheckResult>
} {
  if (!redis) {
    // Fall back to in-memory rate limiter when Redis is not configured.
    const limiter = createRateLimiter({
      windowMs: opts.windowMs,
      max: opts.maxRequests,
    })
    return {
      check: async (key: string) => {
        const result = limiter.check(key)
        return {
          ok: result.ok,
          remaining: result.remaining,
          resetMs: result.resetMs,
        }
      },
    }
  }

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.maxRequests, `${opts.windowMs} ms`),
    prefix: `rl:${opts.prefix}`,
  })

  // In-memory fallback for when Redis is unreachable (network error, free
  // tier exhausted, etc.). Better to fall back to per-instance limiting
  // than to either allow unlimited traffic or reject all requests.
  const fallback = createRateLimiter({
    windowMs: opts.windowMs,
    max: opts.maxRequests,
  })

  return {
    check: async (key: string) => {
      try {
        const result = await ratelimit.limit(key)
        const resetMs = result.reset ? result.reset - Date.now() : opts.windowMs
        return {
          ok: result.success,
          remaining: result.remaining,
          resetMs: Math.max(0, resetMs),
        }
      } catch {
        // Redis unavailable — fall back to in-memory limiter.
        const result = fallback.check(key)
        return {
          ok: result.ok,
          remaining: result.remaining,
          resetMs: result.resetMs,
        }
      }
    },
  }
}
