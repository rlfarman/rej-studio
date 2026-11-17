import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'

/**
 * Rate limits for the MCP tools, on Cloudflare's Rate Limiting bindings
 * (wrangler.jsonc's `ratelimits`).
 *
 * Counted per token name rather than per request or per IP: an agent holds
 * one token across many requests, so a per-IP key would either throttle a
 * whole lab together or not throttle an agent at all.
 *
 * Reads and designs have separate budgets because they cost differently: a
 * search reads cached gene data, while a design is seconds of Worker CPU.
 *
 * With no binding — plain Vitest, or any run outside workerd — there is no
 * limit, said once per isolate rather than on every call.
 */

const log = createLogger('mcp')

export type McpBudget = 'reads' | 'designs'

let warned = false

/** False when the call is over budget and must be refused. */
export async function withinBudget(
  env: ServerEnv,
  budget: McpBudget,
  tokenName: string,
): Promise<boolean> {
  const limiter =
    budget === 'designs' ? env.MCP_DESIGN_LIMITER : env.MCP_READ_LIMITER
  if (!limiter) {
    if (!warned) {
      warned = true
      log.warn('no rate limit binding; MCP calls are not being limited')
    }
    return true
  }
  // The key is namespaced by budget as well as token, so a design does not
  // spend a search's allowance in the shared namespace.
  const { success } = await limiter.limit({ key: `${budget}:${tokenName}` })
  return success
}
