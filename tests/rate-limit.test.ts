import { describe, it, expect } from 'vitest'
import { rateLimit } from '@/lib/rate-limit'

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    // Use a unique key per test to avoid state leaking
    const key = `test-allow-${Date.now()}`
    const result = rateLimit(key)
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(59)
  })

  it('blocks requests over the limit', () => {
    const key = `test-block-${Date.now()}`
    for (let i = 0; i < 60; i++) {
      rateLimit(key)
    }
    const result = rateLimit(key)
    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('tracks remaining count correctly', () => {
    const key = `test-remaining-${Date.now()}`
    const r1 = rateLimit(key)
    expect(r1.remaining).toBe(59)
    const r2 = rateLimit(key)
    expect(r2.remaining).toBe(58)
  })
})
