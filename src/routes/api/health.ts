import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { handleHealth } from '@/server/health'

/**
 * `/api/health` — liveness for uptime monitors, and a corpus check for a
 * caller with HEALTH_AUTH_TOKEN. Public and cheap; see src/server/health.ts.
 */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: ({ request }) => handleHealth(request, env),
      // A monitor that probes with HEAD gets the same answer, without a body.
      HEAD: async ({ request }) => {
        const response = await handleHealth(request, env)
        return new Response(null, {
          status: response.status,
          headers: response.headers,
        })
      },
    },
  },
})
