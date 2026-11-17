import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { handleDevMailbox } from '@/server/accounts/dev-mailbox'

/**
 * `/api/dev/sign-in-code?email=` — the end-to-end tests' mailbox. Answers
 * 404 unless the Worker runs with AUTH_DEV_MAILBOX=true (only Playwright
 * sets it) and the request is to localhost; see
 * src/server/accounts/dev-mailbox.ts.
 */
export const Route = createFileRoute('/api/dev/sign-in-code')({
  server: {
    handlers: {
      GET: ({ request }) => handleDevMailbox(request, env),
    },
  },
})
