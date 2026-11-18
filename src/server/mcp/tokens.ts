import { bearerFrom, secretsMatch } from '../bearer'

/**
 * Who may use the MCP endpoint.
 *
 * People reach the app through the passcode gate, which suits a person with
 * a browser and nothing else. An agent has no browser, so agents get named
 * tokens instead (the gate lets /api/mcp through): each can be withdrawn on its
 * own, each has its own rate-limit budget, and every tool call is logged
 * under its name.
 *
 * Tokens are the `MCP_TOKENS` Worker secret, `name:secret,other:secret`.
 * With none configured the endpoint refuses everything, so a deployment that
 * has not thought about agent access does not quietly have one.
 */

/** A caller that presented a valid token. */
export interface McpToken {
  /** The name this token was issued under. Appears in logs and rate limits. */
  name: string
}

interface ParsedToken {
  name: string
  secret: string
}

/** The smallest secret worth accepting. Short ones are guessable. */
const MIN_SECRET_LENGTH = 24

function parseTokens(raw: string | undefined): ParsedToken[] {
  if (!raw) return []

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const separator = entry.indexOf(':')
      if (separator <= 0) return []
      const name = entry.slice(0, separator).trim()
      const secret = entry.slice(separator + 1).trim()
      if (!name || secret.length < MIN_SECRET_LENGTH) return []
      return [{ name, secret }]
    })
}

/** True when this deployment has at least one usable token. */
export function mcpEnabled(configured: string | undefined): boolean {
  return parseTokens(configured).length > 0
}

/**
 * The token a request presents, or null when it presents none or a wrong one.
 * Never say which: the caller learns only that it was refused.
 */
export function tokenFrom(
  request: Request,
  configured: string | undefined,
): McpToken | null {
  const tokens = parseTokens(configured)
  if (tokens.length === 0) return null

  const presented = bearerFrom(request)
  if (!presented) return null

  // Every configured token is checked, so the work does not depend on which
  // one matched or on how far down the list it is.
  let matched: ParsedToken | null = null
  for (const token of tokens) {
    if (secretsMatch(presented, token.secret)) matched = token
  }
  return matched ? { name: matched.name } : null
}
