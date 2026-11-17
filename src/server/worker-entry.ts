// The Worker's entry: the passcode gate, then Start's handler for /api or the
// static assets for pages, plus the classes the runtime instantiates by name.
// wrangler.jsonc's `main` points here rather than at
// `@tanstack/react-start/server-entry` because a Workflow class has to be a
// named export of the Worker's main module (Cloudflare's TanStack Start
// guide, "Custom entrypoints").
//
// Every request reaches this code first (wrangler.jsonc,
// `assets.run_worker_first`) except static files that carry nothing to gate.

import handler from '@tanstack/react-start/server-entry'

import { gate } from './auth/gate'
import { handleLogin, handleLogout } from './auth/login'

export { DesignWorkflow } from './designs/workflow'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)

    // Sign-in and sign-out are the gate's own doors.
    if (pathname === '/api/login') return handleLogin(request, env)
    if (pathname === '/api/logout') return handleLogout(request)

    const refusal = await gate(request, env)
    if (refusal) return refusal

    // Start's handler takes the request alone; the routes reach the Worker's
    // bindings through `env` from `cloudflare:workers`.
    if (pathname.startsWith('/api/')) return handler.fetch(request)

    // Anything else is a file or a page. The asset layer serves files and,
    // deployed, answers an app route with the prerendered SPA shell
    // (`not_found_handling`), as it would without the Worker in front. Under
    // `vp dev` the binding is Vite's dev server, which also serves the
    // client modules. Where it has no shell to give — `vp dev`, and the
    // build's own prerender of the shell, which fetches / through this
    // Worker — Start renders it.
    const asset = await env.ASSETS.fetch(request)
    return asset.status === 404 ? handler.fetch(request) : asset
  },
} satisfies ExportedHandler<Env>
