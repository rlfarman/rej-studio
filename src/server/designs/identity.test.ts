// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import {
  createTestD1,
  failingD1,
  fakeEmail,
  signInWithCode,
} from '../accounts/test-utils'
import { gateConfig, SESSION_COOKIE_NAME, signSession } from '../auth/session'
import type { ServerEnv } from '../env'
import { accountOwner, identify } from './identity'

const GATE = {
  BASIC_AUTH_PASSWORD: 'splice-test',
  SESSION_SECRET: 'a-test-session-secret-of-at-least-32-chars',
}
const SECRET = 'a-test-accounts-secret-of-at-least-32-chars'

const mailbox = fakeEmail()
const db = createTestD1().binding
const ON: ServerEnv = {
  ...GATE,
  BETTER_AUTH_SECRET: SECRET,
  AUTH_DB: db,
  AUTH_EMAIL: mailbox.binding,
  AUTH_EMAIL_FROM: 'sign-in@rejstudio.com',
}

let passcode: string
let account: { cookie: string; userId: string }

beforeAll(async () => {
  const config = gateConfig(GATE)
  if (config.mode !== 'on') throw new Error('gate off')
  passcode = `${SESSION_COOKIE_NAME}=${await signSession(config)}`
  account = await signInWithCode(ON, mailbox, 'ada@example.com')
})

function request(cookie = '', host = 'localhost:3000') {
  return new Request(`http://${host}/_serverFn/x`, { headers: { cookie } })
}

describe('identify', () => {
  it('is the account, owner user:<id>, past the passcode and signed in', async () => {
    const caller = await identify(request(`${passcode}; ${account.cookie}`), ON)
    expect(caller).toEqual({
      ok: true,
      account: {
        userId: account.userId,
        owner: `user:${account.userId}`,
      },
    })
    expect(accountOwner('abc')).toBe('user:abc')
  })

  it('is nobody in particular past the passcode alone', async () => {
    expect(await identify(request(passcode), ON)).toEqual({
      ok: true,
      account: null,
    })
  })

  it('refuses an account cookie without the passcode', async () => {
    expect(await identify(request(account.cookie), ON)).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('reads as signed out when accounts are off', async () => {
    const off = { ...GATE }
    expect(
      await identify(request(`${passcode}; ${account.cookie}`), off),
    ).toEqual({ ok: true, account: null })
  })

  it('reads as signed out when the account database fails', async () => {
    const broken = {
      ...ON,
      AUTH_DB: failingD1(db),
    }
    expect(
      await identify(request(`${passcode}; ${account.cookie}`), broken),
    ).toEqual({ ok: true, account: null })
  })

  it('lets local development with no passcode through on loopback only', async () => {
    expect(await identify(request(), { AUTH_DB: db })).toEqual({
      ok: true,
      account: null,
    })
    expect(
      await identify(request('', 'rejstudio.com'), { AUTH_DB: db }),
    ).toMatchObject({ ok: false, status: 503 })
  })

  it('refuses everything with the passcode half-configured', async () => {
    expect(
      await identify(request(passcode), { BASIC_AUTH_PASSWORD: 'x' }),
    ).toMatchObject({ ok: false, status: 503 })
  })
})
