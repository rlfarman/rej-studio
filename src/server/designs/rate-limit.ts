import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'

/**
 * The cloud-design budget, per owner, on the DESIGN_LIMITER Rate Limiting
 * binding (wrangler.jsonc).
 *
 * The plan asked for about 20 an hour, but a Rate Limiting binding counts
 * over 10 or 60 seconds only. The binding's limit is 3 a minute instead: it
 * still stops a runaway loop within seconds, while a person (or an agent) can
 * submit a handful of designs back to back. An hourly counter would need
 * state (a Durable Object or KV) that nothing else here needs; the account's
 * Workers spending limit is the backstop for anything slower.
 *
 * Keyed by owner — a sign-in session, or `mcp:<token name>` for an agent —
 * so one browser's designs never spend another's budget. Only a run that actually
 * starts spends it (./service.ts).
 *
 * With no binding (plain Vitest, or any run outside workerd) there is no
 * limit, said once per isolate.
 */

const log = createLogger('designs')

let warned = false

export async function withinDesignBudget(
  env: ServerEnv,
  owner: string,
): Promise<boolean> {
  const limiter = env.DESIGN_LIMITER
  if (!limiter) {
    if (!warned) {
      warned = true
      log.warn('no DESIGN_LIMITER binding; cloud designs are not being limited')
    }
    return true
  }
  const { success } = await limiter.limit({ key: `cloud:${owner}` })
  return success
}
