import { describe, expect, it, vi } from 'vitest'

// Test the in-memory fallback path (no Redis configured)
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn(),
}))

// Ensure UPSTASH env vars are NOT set
delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN

describe('createUpstashRateLimiter (no Redis)', () => {
  it('falls back to in-memory limiter when no Redis env vars', async () => {
    // Re-import to pick up clean env
    const { createUpstashRateLimiter } = await import('./upstash')
    const limiter = createUpstashRateLimiter({
      prefix: 'test',
      maxRequests: 2,
      windowMs: 60_000,
    })

    const result1 = await limiter.check('ip1')
    expect(result1.ok).toBe(true)

    const result2 = await limiter.check('ip1')
    expect(result2.ok).toBe(true)

    const result3 = await limiter.check('ip1')
    expect(result3.ok).toBe(false)
  })

  it('different prefixes create independent limiters', async () => {
    const { createUpstashRateLimiter } = await import('./upstash')
    const limiter1 = createUpstashRateLimiter({
      prefix: 'a',
      maxRequests: 1,
      windowMs: 60_000,
    })
    const limiter2 = createUpstashRateLimiter({
      prefix: 'b',
      maxRequests: 1,
      windowMs: 60_000,
    })

    expect((await limiter1.check('ip1')).ok).toBe(true)
    expect((await limiter1.check('ip1')).ok).toBe(false) // exhausted
    expect((await limiter2.check('ip1')).ok).toBe(true) // different limiter
  })
})
