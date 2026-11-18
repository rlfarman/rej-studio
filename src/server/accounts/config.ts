import type { ServerEnv } from '../env'
import { gateConfig } from '../auth/session'

/**
 * Whether accounts are on, and what they run with.
 *
 * Accounts are optional on top of the passcode gate: the app works without
 * them, and only cloud runs need one. They are on when the Worker has its
 * database (`AUTH_DB`) and a `BETTER_AUTH_SECRET` of 32+ characters. In
 * local development with no passcode set (the gate lets only loopback
 * requests through then) a fixed local secret stands in, so `vp dev` signs
 * in with no setup; anywhere else a missing secret turns accounts off.
 */

export type AccountsConfig =
  | {
      mode: 'on'
      db: D1Database
      secret: string
      /** Hosts Better Auth builds its URLs for (Google's redirect URI). */
      hosts: string[]
      google: { clientId: string; clientSecret: string } | null
    }
  | { mode: 'off'; reason: string }

const MIN_SECRET_LENGTH = 32

/**
 * Only ever used with the passcode gate off, which serves loopback requests
 * alone: a cookie signed with it cannot reach a deployed Worker.
 */
const LOCAL_SECRET = 'rej-studio-local-development-only-accounts-secret'

/** Loopback hosts, on any port, for local development and the tests. */
const LOOPBACK_HOSTS = ['localhost', 'localhost:*', '127.0.0.1', '127.0.0.1:*']

export function accountsConfig(env: ServerEnv): AccountsConfig {
  const db = env.AUTH_DB
  if (!db) return { mode: 'off', reason: 'no AUTH_DB binding' }
  let secret = env.BETTER_AUTH_SECRET ?? ''
  if (!secret && gateConfig(env).mode === 'off') secret = LOCAL_SECRET
  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      mode: 'off',
      reason: `BETTER_AUTH_SECRET missing or shorter than ${MIN_SECRET_LENGTH} characters`,
    }
  }
  const hosts = (env.AUTH_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }
      : null
  return {
    mode: 'on',
    db,
    secret,
    hosts: [...hosts, ...LOOPBACK_HOSTS],
    google,
  }
}
