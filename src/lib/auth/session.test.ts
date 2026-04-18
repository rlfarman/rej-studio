import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_COOKIE_NAME,
  signSession,
  timingSafeEqual,
  verifySession,
} from './session'

const SECRET = 'test-secret-that-is-at-least-32-chars-long'

describe('session', () => {
  const prev = process.env.SESSION_SECRET
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET
  })
  afterEach(() => {
    process.env.SESSION_SECRET = prev
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

  it('rejects a token with a tampered payload', async () => {
    const token = await signSession(60)
    const [payload, sig] = token.split('.')
    const tampered = `${payload}AAAA.${sig}`
    expect(await verifySession(tampered)).toBeNull()
  })

  it('rejects a token with a tampered signature', async () => {
    const token = await signSession(60)
    const [payload, sig] = token.split('.')
    const tampered = `${payload}.${sig.slice(0, -2)}XX`
    expect(await verifySession(tampered)).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(60)
    process.env.SESSION_SECRET = 'different-secret-that-is-also-32-chars'
    expect(await verifySession(token)).toBeNull()
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
    delete process.env.SESSION_SECRET
    await expect(signSession()).rejects.toThrow(/SESSION_SECRET/)
  })

  it('throws when SESSION_SECRET is too short', async () => {
    process.env.SESSION_SECRET = 'too-short'
    await expect(signSession()).rejects.toThrow(/SESSION_SECRET/)
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
