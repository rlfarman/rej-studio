import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  SESSION_COOKIE_NAME,
  signSession,
  timingSafeEqual,
  verifySession,
} from './session'

const SECRET = 'test-secret-that-is-at-least-32-chars-long'

describe('session', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', SECRET)
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('cookie name is stable', () => {
    expect(SESSION_COOKIE_NAME).toBe('rej_session')
  })

  it('round-trips a valid session', async () => {
    const token = await signSession(60)
    const session = await verifySession(token)
    expect(session).not.toBeNull()
    expect(session?.v).toBe(1)
  })

  it('gives each sign-in its own session id', async () => {
    const a = await verifySession(await signSession(60))
    const b = await verifySession(await signSession(60))
    expect(a?.sid).toMatch(/^[0-9a-f-]{36}$/)
    expect(a?.sid).not.toBe(b?.sid)
  })

  it('rejects a token with a tampered payload', async () => {
    const token = await signSession(60)
    const [payload, sig] = token.split('.')
    const tampered = `${payload}AAAA.${sig}`
    expect(await verifySession(tampered)).toBeNull()
  })

  it('rejects a token with a tampered signature', async () => {
    const token = await signSession(60)
    const [payload, sig] = token.split('.')
    // Change the first character: all 6 of its bits are significant. The
    // last base64url character of a 32-byte signature carries only 4, so
    // overwriting the tail occasionally left the decoded bytes unchanged.
    const tampered = `${payload}.${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`
    expect(await verifySession(tampered)).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(60)
    vi.stubEnv('SESSION_SECRET', 'different-secret-that-is-also-32-chars')
    expect(await verifySession(token)).toBeNull()
  })

  it('signs everyone out when the shared password changes', async () => {
    const token = await signSession(60)
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'correct-horse')
    expect(await verifySession(token)).toBeNull()

    // A fresh sign-in under the new password works.
    expect(await verifySession(await signSession(60))).not.toBeNull()
  })

  it('rejects a token signed with the bare secret (pre-rotation format)', async () => {
    // Before sessions were bound to the password, the HMAC key was the raw
    // SESSION_SECRET. Those cookies must not verify any more.
    const encoder = new TextEncoder()
    const payloadB64 = btoa(
      JSON.stringify({ v: 1, sid: 'x', exp: Date.now() / 1000 + 60 }),
    ).replace(/=+$/, '')
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64)),
    )
    const sigB64 = btoa(String.fromCharCode(...sig))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(await verifySession(`${payloadB64}.${sigB64}`)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signSession(60)
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 120_000)
    expect(await verifySession(token)).toBeNull()
  })

  it('rejects undefined and malformed tokens', async () => {
    expect(await verifySession(undefined)).toBeNull()
    expect(await verifySession('')).toBeNull()
    expect(await verifySession('single-segment')).toBeNull()
    expect(await verifySession('a.b.c')).toBeNull()
  })

  it('throws when SESSION_SECRET is missing', async () => {
    vi.stubEnv('SESSION_SECRET', undefined)
    await expect(signSession()).rejects.toThrow(/SESSION_SECRET/)
  })

  it('throws when SESSION_SECRET is too short', async () => {
    vi.stubEnv('SESSION_SECRET', 'too-short')
    await expect(signSession()).rejects.toThrow(/SESSION_SECRET/)
  })

  it('issues and accepts nothing without a password', async () => {
    const token = await signSession(60)
    vi.stubEnv('BASIC_AUTH_PASSWORD', '')
    await expect(signSession()).rejects.toThrow(/BASIC_AUTH_PASSWORD/)
    expect(await verifySession(token)).toBeNull()
  })
})

describe('timingSafeEqual', () => {
  it('returns true for equal strings', async () => {
    expect(await timingSafeEqual('hello', 'hello')).toBe(true)
  })

  it('returns false for unequal strings of same length', async () => {
    expect(await timingSafeEqual('hello', 'world')).toBe(false)
  })

  it('returns false for unequal-length strings', async () => {
    expect(await timingSafeEqual('hi', 'hello')).toBe(false)
  })

  it('returns true for two empty strings', async () => {
    expect(await timingSafeEqual('', '')).toBe(true)
  })
})
