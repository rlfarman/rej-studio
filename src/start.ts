import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

import { refuseOversizedBody } from '@/server/designs/handler'

/**
 * Start's global configuration: request middleware for the server functions
 * (features/design-tool/api/cloud-designs.functions.ts). The passcode gate
 * has already run by the time a request gets here (src/server/worker-entry.ts).
 */

// Start installs this one itself only when there is no src/start.ts: a
// server function must be called from this origin (Sec-Fetch-Site, else
// Origin, else Referer; a request with none of them is refused, 403).
const sameOrigin = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

// Start reads a server function's body before any function middleware or
// validator runs, so the cap has to be here.
const bodyCap = createMiddleware().server(async ({ request, next }) => {
  const refusal = await refuseOversizedBody(request)
  return refusal ?? next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [sameOrigin, bodyCap],
}))
