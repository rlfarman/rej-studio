/**
 * Who may use the MCP endpoint.
 *
 * The rest of the site is behind one shared password and a session cookie,
 * which suits a person with a browser and nothing else. An agent has no
 * browser, and a shared password cannot be revoked for one caller or traced
 * back to one caller, so agents get named tokens instead: each can be
 * withdrawn on its own, each has its own rate-limit budget, and every tool
 * call is logged under its name.
 *
 * Tokens are configured as `MCP_TOKENS=name:secret,other:secret`. With none
 * configured there is no endpoint at all — it answers 404 — so a deployment
 * that has not thought about agent access does not quietly have one.
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
  if (!raw) {
    return []
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const separator = entry.indexOf(':')
      if (separator <= 0) {
        return []
      }
      const name = entry.slice(0, separator).trim()
      const secret = entry.slice(separator + 1).trim()
      if (!name || secret.length < MIN_SECRET_LENGTH) {
        return []
      }
      return [{ name, secret }]
    })
}

/** True when this deployment offers MCP at all. */
export function mcpEnabled(): boolean {
  return parseTokens(process.env.MCP_TOKENS).length > 0
}

/**
 * Compares two secrets in time that does not depend on how much of them
 * matches, so a caller cannot learn a secret one character at a time.
 */
function secretsMatch(presented: string, expected: string): boolean {
  const a = new TextEncoder().encode(presented)
  const b = new TextEncoder().encode(expected)
  // Lengths are not secret, but bail on a fixed-cost path rather than
  // comparing buffers of different sizes.
  if (a.length !== b.length) {
    return false
  }
  let difference = 0
  for (let i = 0; i < a.length; i++) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return difference === 0
}

/**
 * The token a request presents, or null when it presents none or a wrong one.
 * Never say which: the caller learns only that it was refused.
 */
export function tokenFrom(request: Request): McpToken | null {
  const configured = parseTokens(process.env.MCP_TOKENS)
  if (configured.length === 0) {
    return null
  }

  const header = request.headers.get('authorization') ?? ''
  const [scheme, presented] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !presented) {
    return null
  }

  // Every configured token is checked, so the work does not depend on which
  // one matched or on how far down the list it is.
  let matched: ParsedToken | null = null
  for (const token of configured) {
    if (secretsMatch(presented, token.secret)) {
      matched = token
    }
  }
  return matched ? { name: matched.name } : null
}
