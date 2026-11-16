/**
 * Whether the shared-password gate is engaged for this deployment.
 *
 * On whenever BASIC_AUTH_PASSWORD is set. BYPASS_AUTH=true turns it off, but
 * only in development, so a stray env var can't open up a deployed site.
 * Shared by the proxy, requireSession() (server actions), robots.txt and
 * the sitemap so they all agree on when a session is required.
 */
export function isAuthGateActive(): boolean {
  if (!process.env.BASIC_AUTH_PASSWORD) return false
  const bypass =
    process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true'
  return !bypass
}
