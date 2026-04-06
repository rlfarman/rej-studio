import { NextResponse } from 'next/server'

/**
 * CORS origin allowlist for API routes. In production, restrict to the app's
 * own origins (Vercel + Cloudflare Workers). In development, allow localhost.
 */
const ALLOWED_ORIGINS = new Set([
  'https://rejstudio.com',
  'https://rej-studio.vercel.app',
  'https://rej-studio.rejstudio.workers.dev',
])

/** Cloudflare preview deploys use `*-rej-studio.rejstudio.workers.dev`. */
const CF_PREVIEW_PATTERN =
  /^https:\/\/[\w-]+-rej-studio\.rejstudio\.workers\.dev$/

if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.add('http://localhost:3000')
  ALLOWED_ORIGINS.add('http://127.0.0.1:3000')
}

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true
  // Vercel preview deploys
  if (/^https:\/\/rej-studio-[\w-]+\.vercel\.app$/.test(origin)) return true
  // Cloudflare preview deploys
  if (CF_PREVIEW_PATTERN.test(origin)) return true
  return false
}

/**
 * Add CORS headers to a NextResponse. Returns the origin if it's in the
 * allowlist, or omits the header (blocking cross-origin access).
 */
export function withCors(response: NextResponse, origin: string | null) {
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Vary', 'Origin')
  }
  return response
}
