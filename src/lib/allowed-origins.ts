/**
 * Single source of truth for allowed origins. Used by both the proxy (CSRF
 * validation) and API route CORS headers.
 */

const STATIC_ORIGINS = new Set([
  'https://rejstudio.com',
  'https://www.rejstudio.com',
  'https://rej-studio.vercel.app',
])

/** Vercel preview deploys: `rej-studio-<branch>.vercel.app` */
const VERCEL_PREVIEW = /^https:\/\/rej-studio-[\w-]+\.vercel\.app$/

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
