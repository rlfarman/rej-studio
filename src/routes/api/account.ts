import { createFileRoute } from '@tanstack/react-router'
import { env, waitUntil } from 'cloudflare:workers'

import { handleAccount } from '@/server/accounts/handler'

/**
 * `/api/account` — whether accounts are on, how to sign in, and who is
 * signed in, for the sign-in button and the cloud toggle. See
 * src/server/accounts/handler.ts.
 */
export const Route = createFileRoute('/api/account')({
  server: {
    handlers: {
      GET: ({ request }) => handleAccount(request, env, { waitUntil }),
    },
  },
})
