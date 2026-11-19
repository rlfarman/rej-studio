// The Worker's entry: the passcode gate, then Start's handler for /api and
// server functions (/_serverFn) or the static assets for pages, plus the
// classes the runtime instantiates by name.
// wrangler.jsonc's `main` points here rather than at
// `@tanstack/react-start/server-entry` because a Workflow class has to be a
// named export of the Worker's main module (Cloudflare's TanStack Start
// guide, "Custom entrypoints").
//
// Every request reaches this code first (wrangler.jsonc,
// `assets.run_worker_first`) except static files that carry nothing to gate.

import { withSentry } from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'

import { gate, isServerFnCall } from './auth/gate'
import { capServerFnBody } from './body-cap'
import { handleLogin, handleLogout } from './auth/login'
import { sentryOptions } from './sentry'

import { SHELL_PATH, needsShell } from './prerendered-pages'

export { DesignWorkflow } from './designs/workflow'

/**
 * A file, a prerendered page, or the SPA shell.
 *
 * - A prerendered page is its own HTML file, with a query string only when
 *   the page renders the same either way (`/login`; prerendered-pages.ts).
 * - Any other navigation gets the shell, which the client fills in. That
 *   includes a prerendered page with a query string its content depends on.
 * - Where there is no shell file yet (`vp dev`, and the build's prerender,
 *   which fetches its pages through this Worker), Start renders the page.
 */
async function servePage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (!needsShell(url.pathname, url.search)) {
    const asset = await env.ASSETS.fetch(request)
    if (asset.status !== 404) return asset
  }
  const shell = await env.ASSETS.fetch(
    new Request(new URL(SHELL_PATH, url), request),
  )
  // 304 too: a reload revalidates the shell with the ETag it was given.
  if (shell.ok || shell.status === 304) return shell
  return handler.fetch(request)
}

// Wrapped in Sentry: it instruments this `fetch` (errors it throws, and an
// `http.server` span per request) and initializes the SDK from the request's
// own environment. `DesignWorkflow` above stays an unwrapped named export,
// because the runtime looks the class up by name on the main module; the
// Workflow's own errors reach Workers observability.
export default withSentry(sentryOptions, {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)

    // Sign-in and sign-out are the gate's own doors.
    if (pathname === '/api/login') return handleLogin(request, env)
    if (pathname === '/api/logout') return handleLogout(request)

    const refusal = await gate(request, env)
    if (refusal) return refusal

    // Start's handler takes the request alone; the routes and server
    // functions reach the Worker's bindings through `env` from
    // `cloudflare:workers`. Start applies its own same-origin check to server
    // functions; the body cap comes first, because Start reads the body
    // before any server-function code runs.
    if (isServerFnCall(pathname)) {
      const capped = capServerFnBody(request)
      return capped instanceof Response ? capped : handler.fetch(capped)
    }
    if (pathname.startsWith('/api/')) return handler.fetch(request)

    return servePage(request, env)
  },
} satisfies ExportedHandler<Env>)
