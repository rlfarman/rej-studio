import { createMcpHandler } from '@modelcontextprotocol/server'

import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { serverCorpus } from '../gene-data'
import { mcpCopy } from './copy'
import { createRejStudioMcpServer } from './server'
import { mcpEnabled, tokenFrom } from './tokens'

/**
 * The MCP endpoint: REJ Studio for a scientist's own agent.
 *
 * Reachable only with a named token (./tokens.ts). With no tokens configured
 * it refuses every request with 503, so an installation that has not decided
 * about agent access does not have one. It is never open.
 *
 * Stateless, one server per request: `createMcpHandler` builds an instance
 * from the factory for each request and the handler is `Request` in,
 * `Response` out — which is a Worker's own shape, and what Cloudflare
 * recommends over the older session-backed agent.
 *
 * No CORS headers are sent, deliberately. A web page must not be able to use
 * a visitor's browser to run designs through someone else's token.
 */

const log = createLogger('mcp')

function refuse(status: number, message: string): Response {
  const headers: Record<string, string> = { 'cache-control': 'no-store' }
  if (status === 401) {
    // Name the scheme, so a client knows what to present next time.
    headers['www-authenticate'] = 'Bearer realm="REJ Studio MCP"'
  }
  return Response.json({ error: message }, { status, headers })
}

export async function handleMcp(
  request: Request,
  env: ServerEnv,
): Promise<Response> {
  if (!mcpEnabled(env.MCP_TOKENS)) {
    return refuse(503, mcpCopy.http.notConfigured)
  }

  const token = tokenFrom(request, env.MCP_TOKENS)
  if (!token) {
    return refuse(401, mcpCopy.http.unauthorized)
  }

  const corpus = serverCorpus(env)
  if (!corpus) {
    return refuse(503, mcpCopy.http.noGeneData)
  }

  // The view loads its client library from this deployment, so the Worker
  // reads its own origin off the request rather than being told it.
  const bridgeUrl = new URL('/mcp/app-bridge.js', request.url).toString()

  // One server per request, holding only this token's identity: tools are
  // rate limited and logged under the token that called them.
  const handler = createMcpHandler(() =>
    createRejStudioMcpServer({ token, env, corpus, bridgeUrl }),
  )

  try {
    return await handler.fetch(request)
  } catch (error) {
    log.error('mcp request failed', error, { caller: token.name })
    return refuse(500, mcpCopy.http.failed)
  }
}
