/**
 * Single source of truth for allowed origins. Used by both the proxy (CSRF
 * validation) and API route CORS headers.
 */

const STATIC_ORIGINS = new Set([
  'https://rejstudio.com',
  'https://www.rejstudio.com',
  'https://rej-studio.vercel.app',
])

/**
 * This project's Vercel preview deploys, which always end in the team slug:
 * `rej-studio-<hash>-richie-farmans-projects.vercel.app` (per deployment)
 * and `rej-studio-git-<branch>-richie-farmans-projects.vercel.app` (per
 * branch). Matching any `rej-studio-*.vercel.app` also accepted projects in
 * other people's Vercel accounts.
 */
const VERCEL_PREVIEW =
  /^https:\/\/rej-studio-[a-z0-9-]+-richie-farmans-projects\.vercel\.app$/

/**
 * Any local port in development. Pinning :3000 broke server actions (403)
 * for dev servers on other ports, e.g. in parallel git worktrees.
 */
const DEV_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/

export function isAllowedOrigin(origin: string): boolean {
  if (STATIC_ORIGINS.has(origin)) return true
  if (VERCEL_PREVIEW.test(origin)) return true
  if (process.env.NODE_ENV === 'development' && DEV_LOCAL.test(origin)) {
    return true
  }
  return false
}
