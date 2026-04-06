import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRateLimiter } from './rate-limit'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first request', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 })
    const result = limiter.check('ip1')
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('allows up to max requests', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 })
    expect(limiter.check('ip1').ok).toBe(true) // 1st
    expect(limiter.check('ip1').ok).toBe(true) // 2nd
    expect(limiter.check('ip1').ok).toBe(true) // 3rd
  })

  it('blocks max+1 request', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 })
    limiter.check('ip1') // 1
    limiter.check('ip1') // 2
    limiter.check('ip1') // 3
    const result = limiter.check('ip1') // 4th — blocked
    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after window expires', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 })
    limiter.check('ip1')
    limiter.check('ip1')
    expect(limiter.check('ip1').ok).toBe(false)

    vi.advanceTimersByTime(61_000)
    expect(limiter.check('ip1').ok).toBe(true)
  })

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    expect(limiter.check('ip1').ok).toBe(true)
    expect(limiter.check('ip1').ok).toBe(false) // ip1 exhausted
    expect(limiter.check('ip2').ok).toBe(true) // ip2 fresh
  })

  it('returns positive resetMs when limited', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    limiter.check('ip1')
    const result = limiter.check('ip1')
    expect(result.resetMs).toBeGreaterThan(0)
    expect(result.resetMs).toBeLessThanOrEqual(60_000)
  })
})
