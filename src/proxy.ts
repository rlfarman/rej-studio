import { NextRequest, NextResponse } from 'next/server'
import { isAllowedOrigin } from '@/lib/allowed-origins'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - monitoring (Sentry tunnel)
     * - api/og (opengraph images — must be crawlable without auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|monitoring|api/og).*)',
  ],
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

// --- API routes that don't require a session -------------------------------
// HTML routes are always served so crawlers can read metadata; the root
// layout gates the body on session. API routes return 401 without a session
// except for the ones below.
const PUBLIC_API_PREFIXES = [
  '/api/login',
  '/api/logout',
  '/api/csp-report',
  '/api/og',
]

function buildCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.sentry.io",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.googletagmanager.com",
    "font-src 'self'",
    // Sentry Replay (and similar instrumentation) constructs Web Workers from
    // a blob: URL. Without this, default-src blocks them.
    "worker-src 'self' blob:",
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

function isAuthConfigured(): boolean {
  return Boolean(process.env.BASIC_AUTH_PASSWORD)
}

function shouldBypassAuth(): boolean {
  const isDev = process.env.NODE_ENV === 'development'
  return isDev && process.env.BYPASS_AUTH === 'true'
}

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

  // Expose pathname to server components (read via next/headers) so the
  // root layout can build a return_to link when rendering the login gate.
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  const csp = isDev ? undefined : buildCsp()

  // --- API session gate ---
  // Only applies when auth is configured. HTML routes bypass this and gate
  // in the root layout so crawlers can still read per-page metadata.
  const pathname = req.nextUrl.pathname
  if (
    isAuthConfigured() &&
    !shouldBypassAuth() &&
    pathname.startsWith('/api/') &&
    !PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    const session = await verifySession(
      req.cookies.get(SESSION_COOKIE_NAME)?.value,
    )
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      )
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  if (csp) {
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('Reporting-Endpoints', REPORTING_ENDPOINTS)
  }
  return response
}
