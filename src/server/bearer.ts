/**
 * Bearer credentials, shared by the MCP tokens and the health check's token.
 */

/** The secret a request presents as `Authorization: Bearer <secret>`, if any. */
export function bearerFrom(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const [scheme, presented] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !presented) return null
  return presented
}

/**
 * Compares two secrets in time that does not depend on how much of them
 * matches, so a caller cannot learn a secret one character at a time.
 */
export function secretsMatch(presented: string, expected: string): boolean {
  const a = new TextEncoder().encode(presented)
  const b = new TextEncoder().encode(expected)
  // Lengths are not secret, but bail on a fixed-cost path rather than
  // comparing buffers of different sizes.
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return difference === 0
}
