import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { handleCreateDesign } from '@/server/designs/handler'

/**
 * `POST /api/designs` — submit a cloud design (src/server/designs/).
 *
 * Behind the passcode gate, and checked again in the handler: the caller's
 * sign-in session owns the design.
 */
export const Route = createFileRoute('/api/designs/')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateDesign(request, env),
    },
  },
})
