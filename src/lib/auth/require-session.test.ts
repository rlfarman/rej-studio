import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { cookies } from 'next/headers'
import { requireSession } from './require-session'
import { SESSION_COOKIE_NAME, signSession } from './session'

const SECRET = 'test-secret-that-is-at-least-32-chars-long'

function withSessionCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && value !== undefined
        ? { name, value }
        : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

describe('requireSession', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', SECRET)
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
    vi.stubEnv('NODE_ENV', 'production')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(cookies).mockReset()
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>)
  })

  it('is a no-op when the gate is off', async () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', '')
    withSessionCookie(undefined)
    await expect(requireSession()).resolves.toBeUndefined()
  })

  it('rejects a caller without a session cookie', async () => {
    withSessionCookie(undefined)
    await expect(requireSession()).rejects.toThrow('Authentication required.')
  })

  it('rejects a forged session cookie', async () => {
    withSessionCookie('eyJ2IjoxLCJleHAiOjk5OTk5OTk5OTl9.not-a-signature')
    await expect(requireSession()).rejects.toThrow('Authentication required.')
  })

  it('accepts a valid session', async () => {
    withSessionCookie(await signSession(60))
    await expect(requireSession()).resolves.toBeUndefined()
  })

  it('honours BYPASS_AUTH only in development', async () => {
    vi.stubEnv('BYPASS_AUTH', 'true')
    withSessionCookie(undefined)
    await expect(requireSession()).rejects.toThrow()

    vi.stubEnv('NODE_ENV', 'development')
    await expect(requireSession()).resolves.toBeUndefined()
  })
})
