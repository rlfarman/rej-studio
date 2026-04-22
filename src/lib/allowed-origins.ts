/**
 * Single source of truth for allowed origins. Used by both the proxy (CSRF
 * validation) and API route CORS headers.
 */

const STATIC_ORIGINS = new Set([
  'https://rejstudio.com',
  'https://www.rejstudio.com',
  'https://rej-studio.vercel.app',
  'https://rej-studio.rejstudio.workers.dev',
])

if (process.env.NODE_ENV === 'development') {
  STATIC_ORIGINS.add('http://localhost:3000')
  STATIC_ORIGINS.add('http://127.0.0.1:3000')
}

/** Vercel preview deploys: `rej-studio-<branch>.vercel.app` */
const VERCEL_PREVIEW = /^https:\/\/rej-studio-[\w-]+\.vercel\.app$/

/** Cloudflare preview deploys: `<branch>-rej-studio.rejstudio.workers.dev` */
const CF_PREVIEW = /^https:\/\/[\w-]+-rej-studio\.rejstudio\.workers\.dev$/

export function isAllowedOrigin(origin: string): boolean {
  if (STATIC_ORIGINS.has(origin)) return true
  if (VERCEL_PREVIEW.test(origin)) return true
  if (CF_PREVIEW.test(origin)) return true
  return false
}
