import { NextRequest, NextResponse } from 'next/server'
import { isAllowedOrigin } from '@/lib/allowed-origins'
import { isAuthGateActive } from '@/lib/auth/gate'
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
     * - static image and font files from public/ (e.g. /branding/*.png).
     *   The image optimizer fetches these internally without the visitor's
     *   cookies, so gating them broke next/image (the sidebar logo) for
     *   signed-in users too. They carry no gene data.
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|monitoring|api/og|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$).*)',
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

// --- Paths reachable without a session -------------------------------------
// When the gate is active, every other matched request needs a session:
// pages, RSC/prefetch requests, API routes, and server actions (which POST to
// page URLs). Gating only in the root layout is not enough: Next still renders
// the page segment and streams its RSC payload (gene data included) next to
// the login form, and each of those renders queries the database.
// robots.txt, sitemap.xml, favicon.ico, /monitoring and /api/og are excluded
// by the matcher above, so they stay public too.
const PUBLIC_PATHS = [
  '/login',
  '/api/login',
  '/api/logout',
  '/api/csp-report',
  // The MCP endpoint carries its own auth: named bearer tokens, checked in
  // app/api/mcp/tokens.ts. It answers 404 when none are configured.
  '/api/mcp',
  // Liveness only for anonymous callers; deep checks need a token.
  '/api/health',
  '/manifest.webmanifest',
  '/icon',
  '/apple-icon',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/**
 * Page loads go to the login page (which sends the user back afterwards).
 * Everything else — server actions, API calls — gets a 401, since a redirect
 * to an HTML page is meaningless to a fetch() caller.
 */
function rejectUnauthenticated(req: NextRequest): NextResponse {
  const isPageLoad =
    (req.method === 'GET' || req.method === 'HEAD') &&
    !req.nextUrl.pathname.startsWith('/api/')
  if (!isPageLoad) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    )
  }

  const target = req.nextUrl.clone()
  // `_rsc` is Next's cache-busting param on client-side navigations; it
  // shouldn't survive into the post-login redirect.
  target.searchParams.delete('_rsc')
  const returnTo = target.pathname + target.search

  const loginUrl = new URL('/login', req.url)
  if (returnTo !== '/') loginUrl.searchParams.set('return_to', returnTo)
  return NextResponse.redirect(loginUrl)
}

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

  // Expose pathname to server components (read via next/headers) so the
  // root layout can build a return_to link when rendering the login gate.
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  const csp = isDev ? undefined : buildCsp()

  // --- Session gate ---
  if (isAuthGateActive() && !isPublicPath(req.nextUrl.pathname)) {
    const session = await verifySession(
      req.cookies.get(SESSION_COOKIE_NAME)?.value,
    )
    if (!session) return rejectUnauthenticated(req)
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  if (csp) {
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('Reporting-Endpoints', REPORTING_ENDPOINTS)
  }
  return response
}
