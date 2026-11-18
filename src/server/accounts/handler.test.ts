// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { fakeLimiter } from '../designs/test-utils'
import type { ServerEnv } from '../env'
import { accountsConfig } from './config'
import { handleAccount, handleAuth, type AccountState } from './handler'
import { createTestD1, fakeEmail, signInWithCode } from './test-utils'

// The account endpoints through Better Auth's real handler, on an in-memory
// D1 with the committed migrations.

const SITE = 'http://localhost:3000'

let mailbox: ReturnType<typeof fakeEmail>
let env: ServerEnv

beforeEach(() => {
  mailbox = fakeEmail()
  env = {
    AUTH_DB: createTestD1().binding,
    AUTH_EMAIL: mailbox.binding,
    AUTH_EMAIL_FROM: 'sign-in@rejstudio.com',
    AUTH_HOSTS: 'rejstudio.com',
  }
})

async function account(cookie = '', e = env): Promise<AccountState> {
  const response = await handleAccount(
    new Request(`${SITE}/api/account`, { headers: { cookie } }),
    e,
  )
  expect(response.headers.get('cache-control')).toBe('no-store')
  return (await response.json()) as AccountState
}

function sendCode(email: string, e = env, address?: string) {
  return handleAuth(
    new Request(`${SITE}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: SITE,
        ...(address ? { 'cf-connecting-ip': address } : {}),
      },
      body: JSON.stringify({ email, type: 'sign-in' }),
    }),
    e,
  )
}

describe('accountsConfig', () => {
  it('is off without the database', () => {
    expect(accountsConfig({ BETTER_AUTH_SECRET: 'x'.repeat(40) }).mode).toBe(
      'off',
    )
  })

  it('uses a local secret only while the passcode gate is off', () => {
    const db = createTestD1().binding
    expect(accountsConfig({ AUTH_DB: db }).mode).toBe('on')
    expect(
      accountsConfig({
        AUTH_DB: db,
        BASIC_AUTH_PASSWORD: 'p',
        SESSION_SECRET: 's'.repeat(40),
      }).mode,
    ).toBe('off')
  })

  it('refuses a short secret', () => {
    const config = accountsConfig({
      AUTH_DB: createTestD1().binding,
      BETTER_AUTH_SECRET: 'short',
    })
    expect(config).toMatchObject({ mode: 'off' })
  })

  it('offers Google only with both of its secrets', () => {
    const db = createTestD1().binding
    const half = accountsConfig({ AUTH_DB: db, GOOGLE_CLIENT_ID: 'id' })
    const both = accountsConfig({
      AUTH_DB: db,
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
    })
    expect(half.mode === 'on' && half.google).toBeNull()
    expect(both.mode === 'on' && both.google).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
    })
  })
})

describe('GET /api/account', () => {
  it('says accounts are unavailable without the database', async () => {
    expect(await account('', {})).toEqual({
      available: false,
      providers: { email: false, google: false },
      user: null,
    })
  })

  it('is signed out without a session', async () => {
    expect(await account()).toEqual({
      available: true,
      providers: { email: true, google: false },
      user: null,
    })
  })

  it('names the account once signed in with an emailed code', async () => {
    const { cookie } = await signInWithCode(env, mailbox, 'ada@example.com')
    const state = await account(cookie)
    expect(state.user).toMatchObject({ email: 'ada@example.com' })
    expect(state.user!.id).toEqual(expect.any(String))
  })

  it('reports Google when it is configured', async () => {
    const state = await account('', {
      ...env,
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
    })
    expect(state.providers.google).toBe(true)
  })
})

describe('/api/auth/*', () => {
  it('answers 503 when accounts are off', async () => {
    const response = await sendCode('ada@example.com', {})
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'ACCOUNTS_UNAVAILABLE',
    })
  })

  it('emails a six-digit code and stores only its hash', async () => {
    expect((await sendCode('ada@example.com')).status).toBe(200)
    const code = mailbox.codeFor('ada@example.com')
    expect(code).toMatch(/^\d{6}$/)
    const { results } = await env
      .AUTH_DB!.prepare('select value from verification')
      .all<{ value: string }>()
    expect(results).toHaveLength(1)
    expect(results[0].value).not.toContain(code)
  })

  it('refuses a wrong code and signs nobody in', async () => {
    await sendCode('ada@example.com')
    const wrong =
      mailbox.codeFor('ada@example.com') === '000000' ? '111111' : '000000'
    const response = await handleAuth(
      new Request(`${SITE}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: SITE },
        body: JSON.stringify({ email: 'ada@example.com', otp: wrong }),
      }),
      env,
    )
    expect(response.ok).toBe(false)
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('signs out', async () => {
    const { cookie } = await signInWithCode(env, mailbox, 'ada@example.com')
    const response = await handleAuth(
      new Request(`${SITE}/api/auth/sign-out`, {
        method: 'POST',
        headers: { cookie, origin: SITE, 'content-type': 'application/json' },
        body: '{}',
      }),
      env,
    )
    expect(response.status).toBe(200)
    expect((await account(cookie)).user).toBeNull()
  })

  it('limits codes per recipient, before anything is sent', async () => {
    const limited = fakeLimiter(1)
    const e = { ...env, ACCOUNT_EMAIL_LIMITER: limited.binding }
    expect((await sendCode('Ada@Example.com', e)).status).toBe(200)
    const refused = await sendCode('ada@example.com', e)
    expect(refused.status).toBe(429)
    expect(mailbox.sent).toHaveLength(1)
    expect(limited.keys).toEqual([
      'code:ada@example.com',
      'code:ada@example.com',
    ])
  })

  it('limits requests per client address', async () => {
    const limited = fakeLimiter(1)
    const e = { ...env, ACCOUNT_LIMITER: limited.binding }
    expect((await sendCode('a@example.com', e, '203.0.113.7')).status).toBe(200)
    expect((await sendCode('b@example.com', e, '203.0.113.7')).status).toBe(429)
    expect(limited.keys).toEqual(['account:203.0.113.7', 'account:203.0.113.7'])
  })

  it('refuses a send-code request it cannot read', async () => {
    const response = await handleAuth(
      new Request(`${SITE}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: SITE },
        body: 'not json',
      }),
      env,
    )
    expect(response.status).toBe(400)
  })

  it('refuses a cross-site request', async () => {
    const response = await handleAuth(
      new Request(`${SITE}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://elsewhere.example',
        },
        body: JSON.stringify({ email: 'ada@example.com', type: 'sign-in' }),
      }),
      env,
    )
    expect(response.status).toBe(403)
    expect(mailbox.sent).toHaveLength(0)
  })
})
