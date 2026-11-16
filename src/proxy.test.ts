// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'
import { SESSION_COOKIE_NAME, signSession } from '@/lib/auth/session'

const SECRET = 'test-secret-that-is-at-least-32-chars-long'
const ORIGIN = 'https://rejstudio.com'

function request(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new NextRequest(new URL(path, ORIGIN), init)
}

/** NextResponse.next() marks pass-through responses with this header. */
function passedThrough(res: Response) {
  return res.headers.get('x-middleware-next') === '1'
}

describe('proxy session gate', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', SECRET)
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('lets everything through when the gate is off', async () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', '')
    expect(passedThrough(await proxy(request('/genes/TP53')))).toBe(true)
  })

  it('redirects unauthenticated page loads to /login with return_to', async () => {
    const res = await proxy(request('/genes/TP53?species=human'))
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('return_to')).toBe(
      '/genes/TP53?species=human',
    )
  })

  it('drops the _rsc param and omits return_to for the home page', async () => {
    const rsc = await proxy(
      request('/genes/TP53?_rsc=abc123', { headers: { RSC: '1' } }),
    )
    expect(
      new URL(rsc.headers.get('location')!).searchParams.get('return_to'),
    ).toBe('/genes/TP53')

    const home = await proxy(request('/'))
    expect(new URL(home.headers.get('location')!).search).toBe('')
  })

  it('rejects unauthenticated server actions and API calls with 401', async () => {
    const action = await proxy(
      request('/design-tool', {
        method: 'POST',
        headers: { 'Next-Action': 'abc123' },
      }),
    )
    expect(action.status).toBe(401)

    const api = await proxy(request('/api/version'))
    expect(api.status).toBe(401)
  })

  it.each([
    '/login',
    '/login?return_to=/genes',
    '/api/login',
    '/api/health',
    '/icon',
    '/apple-icon',
    '/manifest.webmanifest',
  ])('keeps %s public', async (path) => {
    expect(passedThrough(await proxy(request(path)))).toBe(true)
  })

  it('matches public paths on segment boundaries only', async () => {
    const res = await proxy(request('/login-history'))
    expect(res.status).toBe(307)
  })

  it('lets requests with a valid session through', async () => {
    const token = await signSession(60)
    const headers = { cookie: `${SESSION_COOKIE_NAME}=${token}` }
    expect(
      passedThrough(await proxy(request('/genes/TP53', { headers }))),
    ).toBe(true)
    expect(
      passedThrough(
        await proxy(
          request('/design-tool', {
            method: 'POST',
            headers: { ...headers, 'Next-Action': 'abc123' },
          }),
        ),
      ),
    ).toBe(true)
  })

  it('rejects an expired session', async () => {
    const token = await signSession(-60)
    const res = await proxy(
      request('/genes/TP53', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    )
    expect(res.status).toBe(307)
  })
})
