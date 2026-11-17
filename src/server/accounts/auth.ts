import { betterAuth } from 'better-auth'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { isLoopback } from '../auth/session'
import { accountsConfig, type AccountsConfig } from './config'
import { SIGN_IN_CODE_MINUTES, sendSignInCode } from './email'

/**
 * Better Auth, configured for REJ Studio's optional accounts: a six-digit
 * code emailed to the person (the emailOTP plugin, which signs up a new
 * address on first use) and "Sign in with Google". Everything is stored in
 * the `AUTH_DB` D1 database, which Better Auth recognises as D1 and queries
 * through its built-in Kysely adapter; the schema is migrations/.
 *
 * Its endpoints are served at /api/auth/* (src/routes/api/auth/$.ts, through
 * ./handler.ts), behind the passcode gate: only someone past the passcode
 * can reach them, so only they can create an account.
 *
 * Built once per isolate per env object (`getAuth`): the Worker's env is the
 * same object for the isolate's life, and building the instance is the
 * expensive part.
 */

const log = createLogger('accounts')

const DAY_SECONDS = 60 * 60 * 24

export interface AccountsRuntime {
  /** `waitUntil` from `cloudflare:workers`: work that outlives the response. */
  waitUntil?: (promise: Promise<unknown>) => void
}

function buildAuth(
  config: Extract<AccountsConfig, { mode: 'on' }>,
  env: ServerEnv,
  runtime: AccountsRuntime,
) {
  return betterAuth({
    appName: 'REJ Studio',
    database: config.db,
    secret: config.secret,
    basePath: '/api/auth',
    // Built from each request's host, for the allowed hosts only, so one
    // Worker serves rejstudio.com and its workers.dev name, and Google's
    // redirect URI matches whichever the person used.
    baseURL: { allowedHosts: config.hosts },
    trustedOrigins: config.hosts.flatMap((host) =>
      host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? [`http://${host}`]
        : [`https://${host}`],
    ),
    socialProviders: config.google
      ? {
          google: {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
            prompt: 'select_account',
          },
        }
      : {},
    account: {
      // Google verifies its addresses, so a Google sign-in with the address
      // someone already signs in to by code is the same account.
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    session: {
      // As long as the passcode session (src/server/auth/session.ts).
      expiresIn: 30 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
    },
    // Better Auth's own limiter counts in this isolate's memory, which means
    // nothing across Workers; ./handler.ts limits with the Rate Limiting
    // bindings instead.
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    advanced: {
      // Better Auth skips its origin check when it detects a test runner;
      // checking everywhere keeps the tests honest about what ships.
      disableOriginCheck: false,
      cookiePrefix: 'rej-account',
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      ...(runtime.waitUntil
        ? { backgroundTasks: { handler: runtime.waitUntil } }
        : {}),
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: SIGN_IN_CODE_MINUTES * 60,
        allowedAttempts: 5,
        // Only a hash of the code is stored: a read of the database is not
        // a way in.
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp, type }, ctx) {
          // Sign-in is the only flow offered; the others are for password
          // accounts, which REJ Studio does not have.
          if (type !== 'sign-in') {
            log.warn('refused to send a non-sign-in code', { type })
            return
          }
          const request = ctx?.request
          const sending = sendSignInCode(env, {
            to: email,
            code: otp,
            local: request ? isLoopback(request) : false,
          }).catch((error: unknown) => {
            log.error('sign-in code not sent', error)
          })
          // Not awaited where the runtime can finish it after the response:
          // how long sending takes must not tell a caller anything.
          if (runtime.waitUntil) runtime.waitUntil(sending)
          else await sending
        },
      }),
      // Last, as Better Auth requires: cookies set by auth.api calls made
      // from server functions go out through Start.
      tanstackStartCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof buildAuth>

const instances = new WeakMap<object, Auth>()

/** The Better Auth instance for this env, or null when accounts are off. */
export function getAuth(
  env: ServerEnv,
  runtime: AccountsRuntime = {},
): Auth | null {
  const cached = instances.get(env)
  if (cached) return cached
  const config = accountsConfig(env)
  if (config.mode === 'off') return null
  const auth = buildAuth(config, env, runtime)
  instances.set(env, auth)
  return auth
}

/** The signed-in account behind a request, or null. */
export interface AccountUser {
  id: string
  email: string
  name: string
  image: string | null
}

export async function readAccount(
  request: Request,
  env: ServerEnv,
  runtime: AccountsRuntime = {},
): Promise<AccountUser | null> {
  const auth = getAuth(env, runtime)
  if (!auth) return null
  try {
    // The request, not just its headers: the base URL is built from its
    // host, which a Request made in code carries only in its URL. Passing
    // it would otherwise ask for a Response back.
    const session = await auth.api.getSession({
      headers: request.headers,
      request,
      asResponse: false,
    })
    if (!session) return null
    const { id, email, name, image } = session.user
    return { id, email, name, image: image ?? null }
  } catch (error) {
    // A database hiccup reads as signed out for this request rather than
    // failing a call that may not need an account at all.
    log.error('could not read the account session', error)
    return null
  }
}
