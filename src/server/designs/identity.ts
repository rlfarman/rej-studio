import type { ServerEnv } from '../env'
import { readAccount, type AccountsRuntime } from '../accounts/auth'
import { gateConfig, isLoopback, readSession } from '../auth/session'
import { designsCopy } from './copy'

/**
 * Who is asking, for the cloud-design server functions. Fails closed.
 *
 * Two layers, checked in order:
 *
 * 1. **The passcode.** The Worker's gate (src/server/auth/gate.ts) has
 *    already turned away requests without a passcode session, but this
 *    checks again rather than trust that every route is behind it. With no
 *    passcode configured, the gate is off and only loopback requests reach
 *    the Worker (local development). Past this, a caller may read designs.
 * 2. **An account** (src/server/accounts/), optional. Cloud runs are for
 *   people with one: submitting, deleting and listing need it, and the
 *   account owns what it submits (`user:<id>`), on every device it signs in
 *   on, however often the browser is cleared.
 *
 * Designs submitted before accounts were owned by a passcode session
 * (`session:<id>`); no account matches that, so they can be read but not
 * deleted, and they expire with their retention.
 */

export interface Account {
  userId: string
  /** The owner a design submitted by this account carries. */
  owner: string
}

export type Caller =
  | { ok: true; account: Account | null }
  | { ok: false; status: 401 | 503; message: string }

/** The owner prefix for designs submitted by an account. */
const ACCOUNT_OWNER_PREFIX = 'user:'

export function accountOwner(userId: string): string {
  return `${ACCOUNT_OWNER_PREFIX}${userId}`
}

export async function identify(
  request: Request,
  env: ServerEnv,
  runtime: AccountsRuntime = {},
): Promise<Caller> {
  const config = gateConfig(env)
  if (config.mode === 'misconfigured') {
    return { ok: false, status: 503, message: designsCopy.http.notConfigured }
  }
  if (config.mode === 'off' && !isLoopback(request)) {
    return { ok: false, status: 503, message: designsCopy.http.notConfigured }
  }
  if (config.mode === 'on' && !(await readSession(request, config))) {
    return { ok: false, status: 401, message: designsCopy.http.unauthorized }
  }
  const user = await readAccount(request, env, runtime)
  return {
    ok: true,
    account: user ? { userId: user.id, owner: accountOwner(user.id) } : null,
  }
}
