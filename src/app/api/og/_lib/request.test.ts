// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const limiterCheck = vi.hoisted(() =>
  vi.fn(async (_key: string) => ({ ok: true, remaining: 59, resetMs: 0 })),
)
vi.mock('@/lib/upstash', () => ({
  createUpstashRateLimiter: () => ({ check: limiterCheck }),
  redis: null,
}))

import { ogSiteLabel, ogText, rateLimitOgRequest } from './request'

afterEach(() => {
  limiterCheck.mockClear()
})

describe('ogText', () => {
  it('trims and falls back when empty', () => {
    expect(ogText('  Gene Search  ', 32)).toBe('Gene Search')
    expect(ogText(null, 32, 'REJ Studio')).toBe('REJ Studio')
    expect(ogText('   ', 32, 'REJ Studio')).toBe('REJ Studio')
  })

  it('cuts long text to the limit with an ellipsis', () => {
    const out = ogText('x'.repeat(10_000), 80)
    expect(Array.from(out)).toHaveLength(80)
    expect(out.endsWith('…')).toBe(true)
  })

  it('counts characters, not UTF-16 units', () => {
    expect(ogText('🧬'.repeat(5), 5)).toBe('🧬'.repeat(5))
  })
})

describe('ogSiteLabel', () => {
  it.each([
    'rejstudio.com',
    'rejstudio.com/genes',
    'rejstudio.com/design-tool',
  ])('keeps %s', (value) => {
    expect(ogSiteLabel(value)).toBe(value)
  })

  it.each([
    null,
    'evil.com',
    'rejstudio.com.evil.com',
    'rejstudio.com@evil.com',
    'rejstudio.com/ log in at evil.com',
    `rejstudio.com/${'a'.repeat(100)}`,
  ])('replaces %j with the site name', (value) => {
    expect(ogSiteLabel(value)).toBe('rejstudio.com')
  })
})

describe('rateLimitOgRequest', () => {
  const request = () =>
    new Request('https://rejstudio.com/api/og', {
      headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.7' },
    })

  it('passes requests under the limit, keyed by the trusted IP', async () => {
    expect(await rateLimitOgRequest(request())).toBeNull()
    expect(limiterCheck).toHaveBeenCalledWith('203.0.113.7')
  })

  it('answers 429 with Retry-After over the limit', async () => {
    limiterCheck.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      resetMs: 12_300,
    })
    const res = await rateLimitOgRequest(request())
    expect(res?.status).toBe(429)
    expect(res?.headers.get('retry-after')).toBe('13')
  })
})
