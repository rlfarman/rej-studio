import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cookies, headers } from 'next/headers'
import {
  getClientIp,
  getRateLimitKey,
  getRequestRateLimitKey,
} from './client-ip'
import { SESSION_COOKIE_NAME, signSession } from '@/lib/auth/session'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getClientIp', () => {
  describe('on Vercel', () => {
    beforeEach(() => {
      vi.stubEnv('VERCEL', '1')
    })

    it('prefers the platform headers over x-forwarded-for', () => {
      const h = new Headers({
        'x-forwarded-for': '6.6.6.6',
        'x-real-ip': '2.2.2.2',
        'x-vercel-forwarded-for': '1.1.1.1',
      })
      expect(getClientIp(h)).toBe('1.1.1.1')
      h.delete('x-vercel-forwarded-for')
      expect(getClientIp(h)).toBe('2.2.2.2')
    })

    it('accepts IPv6', () => {
      expect(
        getClientIp(new Headers({ 'x-vercel-forwarded-for': '2001:db8::1' })),
      ).toBe('2001:db8::1')
    })
  })

  describe('elsewhere', () => {
    it('takes the right-most x-forwarded-for hop, not the client-supplied first one', () => {
      const h = new Headers({
        'x-forwarded-for': '6.6.6.6, 10.0.0.1, 203.0.113.7',
      })
      expect(getClientIp(h)).toBe('203.0.113.7')
    })

    it('ignores Vercel headers a client could set off-platform', () => {
      const h = new Headers({
        'x-vercel-forwarded-for': '6.6.6.6',
        'x-forwarded-for': '203.0.113.7',
      })
      expect(getClientIp(h)).toBe('203.0.113.7')
    })

    it('falls back to x-real-ip, then unknown', () => {
      expect(getClientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe(
        '203.0.113.9',
      )
      expect(getClientIp(new Headers())).toBe('unknown')
    })

    it('rejects values that are not IP addresses', () => {
      expect(getClientIp(new Headers({ 'x-forwarded-for': 'not-an-ip' }))).toBe(
        'unknown',
      )
      expect(
        getClientIp(
          new Headers({ 'x-forwarded-for': `1.1.1.1, ${'a'.repeat(500)}` }),
        ),
      ).toBe('unknown')
    })
  })
})

describe('getRateLimitKey', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-chars-long')
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
  })

  const h = new Headers({ 'x-forwarded-for': '203.0.113.7' })

  it('keys signed-in callers by session', async () => {
    const a = await getRateLimitKey(h, await signSession(60))
    const b = await getRateLimitKey(h, await signSession(60))
    expect(a).toMatch(/^sid:/)
    // Two people behind the same IP get separate buckets.
    expect(a).not.toBe(b)
  })

  it('keys everyone else by IP', async () => {
    expect(await getRateLimitKey(h, undefined)).toBe('ip:203.0.113.7')
    expect(await getRateLimitKey(h, 'forged.cookie')).toBe('ip:203.0.113.7')
  })

  it('reads the current request in getRequestRateLimitKey', async () => {
    const token = await signSession(60)
    vi.mocked(headers).mockResolvedValueOnce(
      h as unknown as Awaited<ReturnType<typeof headers>>,
    )
    vi.mocked(cookies).mockResolvedValueOnce({
      get: (name: string) =>
        name === SESSION_COOKIE_NAME ? { name, value: token } : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>)
    expect(await getRequestRateLimitKey()).toMatch(/^sid:/)
  })
})
