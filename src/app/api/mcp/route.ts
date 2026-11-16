import { createMcpHandler } from '@modelcontextprotocol/server'

import { createLogger } from '@/lib/logger'

import { createRejStudioMcpServer } from './server'
import { mcpEnabled, tokenFrom } from './tokens'

/**
 * The MCP endpoint: REJ Studio for a scientist's own agent.
 *
 * Reachable only with a named token (see `./tokens.ts`). With no tokens
 * configured the route answers 404, the same as if it were not deployed, so
 * an installation that has not decided about agent access does not have one.
 *
 * No CORS headers are sent, deliberately. A web page must not be able to use
 * a visitor's browser to submit designs through someone else's token.
 */

// No route segment config here: `cacheComponents` is on (see next.config.ts)
// and rejects it. The route is uncached anyway, because every request reads
// the Authorization header and the request body.

const log = createLogger('mcp')

function refuse(status: number, message: string): Response {
  const headers: Record<string, string> = { 'cache-control': 'no-store' }
  if (status === 401) {
    // Name the scheme, so a client knows what to present next time.
    headers['www-authenticate'] = 'Bearer realm="REJ Studio MCP"'
  }
  return Response.json({ error: message }, { status, headers })
}

async function handle(request: Request): Promise<Response> {
  if (!mcpEnabled()) {
    return refuse(404, 'Not found.')
  }

  const token = tokenFrom(request)
  if (!token) {
    return refuse(401, 'A valid bearer token is required.')
  }

  // One server per request, holding only this token's identity: tools are
  // rate limited and logged under the token that called them.
  const handler = createMcpHandler(() => createRejStudioMcpServer(token))

  try {
    return await handler.fetch(request)
  } catch (error) {
    log.error('mcp request failed', error, { caller: token.name })
    return refuse(500, 'The MCP endpoint failed to handle that request.')
  }
}

export const GET = handle
export const POST = handle
export const DELETE = handle
