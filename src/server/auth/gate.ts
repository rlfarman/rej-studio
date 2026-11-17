import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { authCopy } from './copy'
import { gateConfig, isLoopback, readSession, type GateConfig } from './session'

/**
 * The passcode gate, run by the Worker before anything else.
 *
 * Which requests reach the Worker at all is set by `assets.run_worker_first`
 * in wrangler.jsonc: every path except static files that carry no data (the
 * content-hashed bundles, the optimizer's .wasm, icons, the sample corpus,
 * the MCP view's client library). Everything that does arrive needs a
 * session, apart from PUBLIC_PATHS.
 *
 * Without one, a page load is sent to /login (which brings the visitor back
 * afterwards) and anything else gets a 401, since a redirect to an HTML page
 * means nothing to a fetch() caller.
 */

const log = createLogger('auth')

const PUBLIC_PATHS = [
  '/login',
  '/api/login',
  '/api/logout',
  // The MCP endpoint carries its own auth: named bearer tokens
  // (src/server/mcp/tokens.ts).
  '/api/mcp',
  // Liveness for anyone; the deep check needs HEALTH_AUTH_TOKEN.
  '/api/health',
]

/**
 * `vp dev` only: Vite's own module requests come through the Worker too
 * (deployed, the same code is the hashed /assets/* files, which skip it), and
 * the login page cannot run without them.
 */
const DEV_MODULE_PREFIXES = ['/@', '/src/', '/node_modules/', '/__']

function isPublicPath(pathname: string): boolean {
  if (
    import.meta.env.DEV &&
    DEV_MODULE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return true
  }
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

/**
 * Where Start serves server functions: its default `serverFns.base`, which
 * vite.config.ts leaves as it is.
 */
const SERVER_FN_BASE = '/_serverFn/'

/** A server-function call (a fetch() from the app, even when it is a GET). */
export function isServerFnCall(pathname: string): boolean {
  return pathname.startsWith(SERVER_FN_BASE)
}

function isPageLoad(request: Request, pathname: string): boolean {
  return (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !pathname.startsWith('/api/') &&
    !isServerFnCall(pathname)
  )
}

/**
 * Resolves `return_to` to a same-origin path, falling back to `/`. A prefix
 * check alone is not enough against open redirects: URL parsing treats a
 * backslash like a slash, so `/\evil.com` resolves to https://evil.com/.
 */
export function safeReturnTo(raw: string | null, base: string): string {
  if (!raw || !raw.startsWith('/')) return '/'
  try {
    const url = new URL(raw, base)
    if (url.origin !== new URL(base).origin) return '/'
    if (url.pathname === '/login') return '/'
    return url.pathname + url.search
  } catch {
    return '/'
  }
}

function unavailable(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  )
}

/** Why the gate refuses everything when it is not configured, or null. */
export function refuseUnconfigured(
  request: Request,
  config: GateConfig,
): Response | null {
  if (config.mode === 'misconfigured') {
    log.error(`passcode gate misconfigured: ${config.reason}`)
    return unavailable(authCopy.notConfigured)
  }
  if (config.mode === 'off' && !isLoopback(request)) {
    log.error(
      'BASIC_AUTH_PASSWORD and SESSION_SECRET are not set; refusing a non-local request',
    )
    return unavailable(authCopy.notConfigured)
  }
  return null
}

/** A response that stops the request, or null to let it through. */
export async function gate(
  request: Request,
  env: ServerEnv,
): Promise<Response | null> {
  const config = gateConfig(env)
  const refusal = refuseUnconfigured(request, config)
  if (refusal) return refusal
  // Off, on a loopback host: local development with no passcode set.
  if (config.mode !== 'on') return null

  const url = new URL(request.url)
  const session = await readSession(request, config)

  // Already signed in: the login page has nothing to offer.
  if (session && url.pathname === '/login') {
    return Response.redirect(
      new URL(safeReturnTo(url.searchParams.get('return_to'), url.origin), url),
      302,
    )
  }
  if (session || isPublicPath(url.pathname)) return null

  if (!isPageLoad(request, url.pathname)) {
    // A server function answers with a value its caller switches on
    // (features/design-tool/types/cloud-design.ts, `CloudAnswer`), and Start's
    // client returns a JSON body as that value, so the gate answers in the
    // same shape; anything else gets `{ error }`.
    const body = isServerFnCall(url.pathname)
      ? { ok: false, reason: 'unauthorized', message: authCopy.signInRequired }
      : { error: authCopy.signInRequired }
    return Response.json(body, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    })
  }
  const login = new URL('/login', url)
  const returnTo = url.pathname + url.search
  if (returnTo !== '/') login.searchParams.set('return_to', returnTo)
  return Response.redirect(login, 302)
}
