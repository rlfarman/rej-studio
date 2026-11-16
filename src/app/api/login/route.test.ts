// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/upstash', () => ({
  createUpstashRateLimiter: () => ({
    check: vi.fn(async () => ({ ok: true, remaining: 4, resetMs: 60_000 })),
  }),
  redis: null,
}))

import { POST } from './route'

const ORIGIN = 'https://rejstudio.com'

function login(password: string, returnTo?: string) {
  const form = new FormData()
  form.set('password', password)
  if (returnTo !== undefined) form.set('return_to', returnTo)
  return POST(
    new NextRequest(`${ORIGIN}/api/login`, { method: 'POST', body: form }),
  )
}

describe('POST /api/login', () => {
  beforeEach(() => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
    vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-chars-long')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redirects to return_to and sets the session cookie', async () => {
    const res = await login('hunter2', '/genes/TP53?species=human')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      `${ORIGIN}/genes/TP53?species=human`,
    )
    expect(res.headers.get('set-cookie')).toContain('rej_session=')
  })

  it.each(['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com'])(
    'refuses to redirect off-site via %s',
    async (returnTo) => {
      const res = await login('hunter2', returnTo)
      expect(res.headers.get('location')).toBe(`${ORIGIN}/`)
    },
  )

  it('keeps return_to on the error redirect for a wrong password', async () => {
    const res = await login('wrong', '/genes/TP53')
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('1')
    expect(location.searchParams.get('return_to')).toBe('/genes/TP53')
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('drops an off-site return_to on the error redirect', async () => {
    const res = await login('wrong', '/\\evil.com')
    const location = new URL(res.headers.get('location')!)
    expect(location.searchParams.get('return_to')).toBeNull()
  })
})
