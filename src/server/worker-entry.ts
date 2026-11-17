// The Worker's entry: Start's handler for every request, plus the classes the
// runtime instantiates by name. wrangler.jsonc's `main` points here rather
// than at `@tanstack/react-start/server-entry` because a Workflow class has to
// be a named export of the Worker's main module (Cloudflare's TanStack Start
// guide, "Custom entrypoints").
//
// Pages never reach this code: they are static assets, and the Worker only
// answers /api/* (wrangler.jsonc, `assets.run_worker_first`) plus the
// Workflow's own invocations.

import handler from '@tanstack/react-start/server-entry'

export { DesignWorkflow } from './designs/workflow'

export default {
  // Start's handler takes the request alone; the Worker's bindings reach the
  // routes through `env` from `cloudflare:workers`.
  fetch: (request) => handler.fetch(request),
} satisfies ExportedHandler<Env>
