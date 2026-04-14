import { NextRequest, NextResponse } from 'next/server'
import { isAllowedOrigin } from '@/lib/allowed-origins'

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - monitoring (Sentry tunnel)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|monitoring).*)',
  ],
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const aBuf = encoder.encode(a)
  const bBuf = encoder.encode(b)
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const aMac = await crypto.subtle.sign('HMAC', key, aBuf)
  const bMac = await crypto.subtle.sign('HMAC', key, bBuf)
  const aArr = new Uint8Array(aMac)
  const bArr = new Uint8Array(bMac)
  let result = aArr.length === bArr.length ? 1 : 0
  for (let i = 0; i < aArr.length; i++) {
    result &= aArr[i] === bArr[i] ? 1 : 0
  }
  return result === 1
}

// --- Rate limiter for auth attempts -----------------------------------------
// Inline sliding-window limiter (proxy runs in Edge runtime, so we can't
// import from @/lib/rate-limit). 5 failed auth attempts per minute per IP.
const AUTH_WINDOW_MS = 60_000
const AUTH_MAX = 5
const authAttempts = new Map<string, number[]>()
let authLastCleanup = Date.now()

function checkAuthRate(ip: string): boolean {
  const now = Date.now()
  // Periodic cleanup
  if (now - authLastCleanup > AUTH_WINDOW_MS) {
    authLastCleanup = now
    const cutoff = now - AUTH_WINDOW_MS
    for (const [key, timestamps] of authAttempts) {
      const filtered = timestamps.filter((t) => t > cutoff)
      if (filtered.length === 0) authAttempts.delete(key)
      else authAttempts.set(key, filtered)
    }
  }
  const cutoff = now - AUTH_WINDOW_MS
  const timestamps = (authAttempts.get(ip) ?? []).filter((t) => t > cutoff)
  timestamps.push(now)
  authAttempts.set(ip, timestamps)
  return timestamps.length <= AUTH_MAX
}

// --- Request body size limit ------------------------------------------------
// Cap mutating request bodies at 256 KB. The largest legitimate payload is a
// 50,000-char CDS (~50 KB) plus JSON overhead. This blocks oversized uploads
// before they reach server actions.
const MAX_BODY_BYTES = 256 * 1024

// --- CSRF: Origin validation for mutating requests --------------------------
// Next.js server actions use POST. Reject cross-origin POSTs that don't come
// from our own domains. This is defense-in-depth on top of Next.js's built-in
// Origin check (which only validates server actions, not API routes).
// Origin allowlist is shared with API-route CORS in @/lib/allowed-origins.

function buildCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.sentry.io",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.googletagmanager.com",
    "font-src 'self'",
    "connect-src 'self' https://*.sentry.io https://www.google-analytics.com https://*.modal.run",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ')
}

// Reporting-Endpoints header for the Reporting API v1 (report-to directive).
const REPORTING_ENDPOINTS = 'csp-endpoint="/api/csp-report"'

export async function proxy(req: NextRequest) {
  // --- CSRF check (mutating requests) ---
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin')
    if (origin && !isAllowedOrigin(origin)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    // --- Body size limit ---
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return new NextResponse('Payload Too Large', { status: 413 })
    }
  }

  // --- CSP nonce (production only) ---
  // CSP is skipped in development because:
  // 1. React dev mode requires eval() which CSP blocks
  // 2. Next.js applies x-nonce to <Script> tags server-side, but browsers
  //    strip nonce attributes from the DOM (HTML spec), causing hydration
  //    mismatches that cannot be fixed without patching Next.js itself
  const isDev = process.env.NODE_ENV === 'development'
  const requestHeaders = new Headers(req.headers)

  const csp = isDev ? undefined : buildCsp()

  // --- Basic auth (all routes) ---
  if (!(isDev && process.env.BYPASS_AUTH === 'true')) {
    const basicAuth = req.headers.get('authorization')
    const expectedUser = process.env.BASIC_AUTH_USER
    const expectedPassword = process.env.BASIC_AUTH_PASSWORD

    let authenticated = false
    if (basicAuth && expectedUser && expectedPassword) {
      try {
        const authValue = basicAuth.split(' ')[1]
        const [user, pwd] = atob(authValue).split(':')
        const userMatch = await timingSafeEqual(user, expectedUser)
        const pwdMatch = await timingSafeEqual(pwd, expectedPassword)
        authenticated = userMatch && pwdMatch
      } catch {
        // Malformed Base64
      }
    }

    if (!authenticated && expectedUser && expectedPassword) {
      // Rate limit failed auth attempts to prevent brute-force.
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      if (!checkAuthRate(ip)) {
        return new NextResponse('Too Many Requests', { status: 429 })
      }

      const url = req.nextUrl.clone()
      url.pathname = '/api/auth'
      const response = NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      })
      if (csp) {
        response.headers.set('Content-Security-Policy', csp)
        response.headers.set('Reporting-Endpoints', REPORTING_ENDPOINTS)
      }
      return response
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  if (csp) {
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('Reporting-Endpoints', REPORTING_ENDPOINTS)
  }
  return response
}
