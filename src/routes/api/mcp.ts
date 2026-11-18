import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

import { handleMcp } from '@/server/mcp/handler'

/**
 * `/api/mcp` — the MCP endpoint, for a scientist's own agent.
 *
 * Its own auth: named bearer tokens in the MCP_TOKENS secret, checked in
 * src/server/mcp/tokens.ts, with 503 when none are configured. The passcode
 * gate lets this path through (src/server/auth/gate.ts), because an agent
 * has no browser to sign in with.
 *
 * GET and DELETE are the 2025-era session operations; the stateless handler
 * answers them 405 itself, which is the honest answer here.
 */
export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
      GET: ({ request }) => handleMcp(request, env),
      POST: ({ request }) => handleMcp(request, env),
      DELETE: ({ request }) => handleMcp(request, env),
    },
  },
})
