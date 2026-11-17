import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { handleCreateDesign } from '@/server/designs/handler'

/**
 * `POST /api/designs` — submit a cloud design (src/server/designs/).
 *
 * Behind Cloudflare Access, and verified again in the Worker: the caller's
 * Access email owns the design.
 */
export const Route = createFileRoute('/api/designs/')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateDesign(request, env),
    },
  },
})
