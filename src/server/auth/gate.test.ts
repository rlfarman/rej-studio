// @vitest-environment node
import { describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import type { ServerEnv } from '../env'
import { gate, safeReturnTo } from './gate'
import { handleLogin, handleLogout } from './login'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from './session'

const SITE = 'https://rej.example.com'
const ON: ServerEnv = {
  BASIC_AUTH_PASSWORD: 'splice',
  SESSION_SECRET: 'a-session-secret-that-is-at-least-32-chars',
}

function get(path: string, cookie?: string): Request {
  return new Request(`${SITE}${path}`, {
    headers: cookie ? { cookie } : {},
  })
}

function login(
  password: string,
  { returnTo, origin = SITE }: { returnTo?: string; origin?: string } = {},
): Request {
  const body = new URLSearchParams({ password })
  if (returnTo) body.set('return_to', returnTo)
  return new Request(`${SITE}/api/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin,
    },
    body,
  })
}

/** Signs in through the real handler and returns the cookie to send back. */
async function signIn(env: ServerEnv = ON): Promise<string> {
  const response = await handleLogin(login('splice'), env)
  const setCookie = response.headers.get('set-cookie') ?? ''
  return setCookie.split(';')[0]
}

describe('the gate, with a passcode set', () => {
  it('sends a signed-out page load to the login page, and back after', async () => {
    const response = await gate(get('/genes/TP53?species=human'), ON)
    expect(response?.status).toBe(302)
    const location = new URL(response!.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('return_to')).toBe(
      '/genes/TP53?species=human',
    )
  })

  it('leaves return_to off for the home page', async () => {
    const response = await gate(get('/'), ON)
    expect(response!.headers.get('location')).toBe(`${SITE}/login`)
  })

  it('answers a signed-out API call with 401, not a redirect', async () => {
    const response = await gate(get('/api/designs/abc'), ON)
    expect(response?.status).toBe(401)
  })

  it.each(['GET', 'POST'])(
    'answers a signed-out %s server-function call with a 401 refusal its caller can read',
    async (method) => {
      const response = await gate(
        new Request(`${SITE}/_serverFn/abc`, { method }),
        ON,
      )
      expect(response?.status).toBe(401)
      expect(await response!.json()).toMatchObject({
        ok: false,
        reason: 'unauthorized',
      })
    },
  )

  it.each(['/login', '/api/login', '/api/logout', '/api/mcp', '/api/health'])(
    'lets %s through without a session',
    async (path) => {
      expect(await gate(get(path), ON)).toBeNull()
    },
  )

  it('does not mistake a longer path for a public one', async () => {
    expect((await gate(get('/loginx'), ON))?.status).toBe(302)
    expect((await gate(get('/api/mcpx'), ON))?.status).toBe(401)
  })

  it('lets a signed-in request through', async () => {
    const cookie = await signIn()
    expect(await gate(get('/design-tool'), ON)).not.toBeNull()
    expect(await gate(get('/design-tool', cookie), ON)).toBeNull()
    expect(await gate(get('/api/version', cookie), ON)).toBeNull()
  })

  it('sends a signed-in visitor on from the login page', async () => {
    const cookie = await signIn()
    const response = await gate(
      get('/login?return_to=%2Fdesign-tool', cookie),
      ON,
    )
    expect(response?.status).toBe(302)
    expect(response!.headers.get('location')).toBe(`${SITE}/design-tool`)
  })

  it('refuses a tampered cookie', async () => {
    const cookie = await signIn()
    const [body, signature] = cookie.split('=')[1].split('.')
    const forged = `${SESSION_COOKIE_NAME}=${body}x.${signature}`
    expect((await gate(get('/'), ON))?.status).toBe(302)
    expect((await gate(get('/', forged), ON))?.status).toBe(302)
  })

  it('signs everyone out when the passcode changes', async () => {
    const cookie = await signIn()
    const rotated = { ...ON, BASIC_AUTH_PASSWORD: 'ligate' }
    expect((await gate(get('/', cookie), rotated))?.status).toBe(302)
  })

  it('refuses a session past its expiry', async () => {
    const cookie = await signIn()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(Date.now() + (SESSION_MAX_AGE_SECONDS + 60) * 1000)
      expect((await gate(get('/', cookie), ON))?.status).toBe(302)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the gate, without a passcode', () => {
  it('lets local development through', async () => {
    expect(await gate(new Request('http://localhost:3000/'), {})).toBeNull()
  })

  it('refuses everything on a deployed host rather than serve it openly', async () => {
    expect((await gate(get('/'), {}))?.status).toBe(503)
  })

  it('refuses everything when half-configured', async () => {
    const half = { BASIC_AUTH_PASSWORD: 'splice' }
    expect(
      (await gate(new Request('http://localhost:3000/'), half))?.status,
    ).toBe(503)
    const shortSecret = { ...ON, SESSION_SECRET: 'too-short' }
    expect((await gate(get('/'), shortSecret))?.status).toBe(503)
  })
})

describe('signing in', () => {
  it('sets an HttpOnly, Secure session cookie and goes back', async () => {
    const response = await handleLogin(
      login('splice', { returnTo: '/design-tool?job=abc' }),
      ON,
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${SITE}/design-tool?job=abc`)
    const setCookie = response.headers.get('set-cookie')!
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=`))
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Lax')
  })

  it('sends a wrong passcode back to the form, keeping where to go', async () => {
    const response = await handleLogin(
      login('ligate', { returnTo: '/design-tool' }),
      ON,
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('set-cookie')).toBeNull()
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('passcode')
    expect(location.searchParams.get('return_to')).toBe('/design-tool')
  })

  it('refuses a sign-in posted from another site', async () => {
    const response = await handleLogin(
      login('splice', { origin: 'https://evil.example' }),
      ON,
    )
    expect(response.status).toBe(403)
  })

  it('refuses once the attempt budget is spent', async () => {
    const env = {
      ...ON,
      LOGIN_LIMITER: { limit: async () => ({ success: false }) },
    } as ServerEnv
    const response = await handleLogin(login('splice'), env)
    expect(response.status).toBe(303)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(
      new URL(response.headers.get('location')!).searchParams.get('error'),
    ).toBe('limit')
  })

  it('accepts only POST', async () => {
    expect((await handleLogin(get('/api/login'), ON)).status).toBe(405)
  })

  it('signs out by clearing the cookie', async () => {
    const response = handleLogout(
      new Request(`${SITE}/api/logout`, {
        method: 'POST',
        headers: { origin: SITE },
      }),
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${SITE}/login`)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})

describe('safeReturnTo', () => {
  it.each([
    ['/genes/TP53?species=human', '/genes/TP53?species=human'],
    ['https://evil.example/', '/'],
    ['//evil.example/', '/'],
    ['/\\evil.example', '/'],
    ['/login?return_to=/x', '/'],
    [null, '/'],
  ])('%s → %s', (raw, expected) => {
    expect(safeReturnTo(raw, SITE)).toBe(expected)
  })
})
