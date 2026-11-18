import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import {
  getAuth,
  readAccount,
  type AccountUser,
  type AccountsRuntime,
} from './auth'
import { accountsConfig } from './config'
import { accountsCopy } from './copy'

/**
 * The Worker's account endpoints, for the routes in src/routes/api/:
 *
 * - `/api/auth/*`: Better Auth's own endpoints (send a code, sign in with it,
 *   start and finish Google, read the session, sign out), each request first
 *   counted against the Rate Limiting bindings.
 * - `GET /api/account`: what the page needs to draw its sign-in state in one
 *   request, without loading the auth client: whether accounts are on, which
 *   ways to sign in exist, and who is signed in.
 *
 * Both are behind the passcode gate (src/server/auth/gate.ts).
 */

const log = createLogger('accounts')

const SEND_CODE_PATH = '/api/auth/email-otp/send-verification-otp'

function refuse(status: number, message: string, code: string): Response {
  // Better Auth's own error shape, so the client reads ours the same way.
  return Response.json(
    { code, message },
    { status, headers: { 'cache-control': 'no-store' } },
  )
}

/** One unit of `limiter` for `key`; no binding means no limit. */
async function within(
  limiter: RateLimit | undefined,
  key: string,
): Promise<boolean> {
  if (!limiter) return true
  const { success } = await limiter.limit({ key })
  return success
}

/** The address a send-code request is for, read from a copy of its body. */
async function codeRecipient(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown }
    return typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : null
  } catch {
    return null
  }
}

export async function handleAuth(
  request: Request,
  env: ServerEnv,
  runtime: AccountsRuntime = {},
): Promise<Response> {
  const auth = getAuth(env, runtime)
  if (!auth) {
    return refuse(503, accountsCopy.http.unavailable, 'ACCOUNTS_UNAVAILABLE')
  }
  if (request.method === 'POST') {
    // Cloudflare's client address; locally there is none to count by (see
    // src/server/auth/login.ts for the same reasoning).
    const address = request.headers.get('cf-connecting-ip')
    if (address && !(await within(env.ACCOUNT_LIMITER, `account:${address}`))) {
      log.warn('account request refused: address budget spent')
      return refuse(429, accountsCopy.http.rateLimited, 'RATE_LIMITED')
    }
    if (new URL(request.url).pathname === SEND_CODE_PATH) {
      const email = await codeRecipient(request)
      if (!email) {
        return refuse(400, accountsCopy.http.badRequest, 'BAD_REQUEST')
      }
      if (!(await within(env.ACCOUNT_EMAIL_LIMITER, `code:${email}`))) {
        log.warn('sign-in code refused: recipient budget spent')
        return refuse(429, accountsCopy.http.codeLimited, 'RATE_LIMITED')
      }
    }
  }
  return auth.handler(request)
}

/** `GET /api/account`'s answer. */
export interface AccountState {
  /** Accounts are on in this deployment. */
  available: boolean
  /** The ways to sign in on offer. */
  providers: { email: boolean; google: boolean }
  user: AccountUser | null
}

export async function handleAccount(
  request: Request,
  env: ServerEnv,
  runtime: AccountsRuntime = {},
): Promise<Response> {
  const config = accountsConfig(env)
  const state: AccountState =
    config.mode === 'off'
      ? {
          available: false,
          providers: { email: false, google: false },
          user: null,
        }
      : {
          available: true,
          providers: { email: true, google: config.google !== null },
          user: await readAccount(request, env, runtime),
        }
  return Response.json(state, {
    headers: { 'cache-control': 'no-store', vary: 'cookie' },
  })
}
