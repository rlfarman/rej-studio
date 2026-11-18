import { createFileRoute } from '@tanstack/react-router'
import { env, waitUntil } from 'cloudflare:workers'

import { handleAuth } from '@/server/accounts/handler'

/**
 * `/api/auth/*` — Better Auth's endpoints for accounts (email codes and
 * Google). Behind the passcode gate; see src/server/accounts/.
 */
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request, env, { waitUntil }),
      POST: ({ request }) => handleAuth(request, env, { waitUntil }),
    },
  },
})
