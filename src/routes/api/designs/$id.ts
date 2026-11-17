import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { handleDeleteDesign, handleGetDesign } from '@/server/designs/handler'

/**
 * `GET /api/designs/:id` reads a cloud design (anyone signed in: the id is a
 * hash of the request), `DELETE` removes it (its owner only). See
 * src/server/designs/service.ts.
 */
export const Route = createFileRoute('/api/designs/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetDesign(request, env, params.id),
      DELETE: ({ request, params }) =>
        handleDeleteDesign(request, env, params.id),
    },
  },
})
