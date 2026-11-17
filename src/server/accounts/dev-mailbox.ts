import type { ServerEnv } from '../env'
import { isLoopback } from '../auth/session'

/**
 * The end-to-end tests' mailbox: the last sign-in code sent to each address,
 * kept in this isolate's memory, so Playwright can sign in with an emailed
 * code without a real inbox (`GET /api/dev/sign-in-code?email=`).
 *
 * Two locks keep it out of production:
 *
 * - Codes are kept only while `AUTH_DEV_MAILBOX` is `true`, which only
 *   playwright.config.ts sets (through the process environment the
 *   Cloudflare plugin passes to a local Worker). It is not in wrangler.jsonc
 *   or .dev.vars.example, so a deployed Worker never has it.
 * - The read answers only a loopback request (`localhost`, `127.0.0.1`): a
 *   request to a deployed Worker carries its public hostname, so even a
 *   Worker given the variable by mistake would refuse every read.
 *
 * The route also sits behind the passcode gate like every other `/api/*`.
 */

const codes = new Map<string, string>()

function enabled(env: ServerEnv): boolean {
  return env.AUTH_DEV_MAILBOX === 'true'
}

/** Keeps the code, when the mailbox is on. */
export function rememberSignInCode(
  env: ServerEnv,
  email: string,
  code: string,
): void {
  if (enabled(env)) codes.set(email.toLowerCase(), code)
}

/** `GET /api/dev/sign-in-code?email=…`: the last code, or 404. */
export function handleDevMailbox(request: Request, env: ServerEnv): Response {
  const headers = { 'cache-control': 'no-store' }
  if (!enabled(env) || !isLoopback(request)) {
    return new Response(null, { status: 404, headers })
  }
  const email = new URL(request.url).searchParams.get('email') ?? ''
  const code = codes.get(email.toLowerCase())
  return code
    ? Response.json({ code }, { headers })
    : new Response(null, { status: 404, headers })
}
