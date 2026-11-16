import { NextRequest, NextResponse } from 'next/server'
import { isAllowedOrigin } from '@/lib/allowed-origins'
import { isAuthGateActive } from '@/lib/auth/gate'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (build assets and the image optimizer)
     * - branding/ (the only folder in public/; the image optimizer fetches
     *   these internally without the visitor's cookies, so gating them broke
     *   next/image for signed-in users too. They carry no gene data.)
     * - monitoring (Sentry tunnel)
     * - api/og (opengraph images — must be crawlable without auth; the
     *   routes validate their input and rate-limit themselves)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     *
     * Exclusions are anchored to whole path segments. Excluding by file
     * extension instead (`.*\\.png$`) also skipped dynamic routes, so
     * /genes/TP53.png rendered the gene page with no session and no CSP.
     */
    '/((?!(?:_next/static|_next/image|branding|monitoring|api/og)(?:/|$)|(?:favicon\\.ico|sitemap\\.xml|robots\\.txt)$).*)',
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
// robots.txt, sitemap.xml, favicon.ico, /branding, /monitoring and /api/og
// are excluded by the matcher above, so they stay public too. The icon and
// manifest routes are listed so browsers and the OS can fetch them for the
// login page and installed-app tiles.
const PUBLIC_PATHS = [
  '/login',
  '/api/login',
  '/api/logout',
  '/api/csp-report',
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

/**
 * Content-Security-Policy for production responses.
 *
 * Scripts keep 'unsafe-inline': a nonce would force every page to render
 * dynamically, and the prerendered static shells (Cache Components / PPR)
 * can't carry a per-request nonce. See the Next.js CSP guide.
 *
 * Third-party hosts are the minimum the browser itself talks to:
 * - Google Tag Manager / GA4: Google's documented hosts for GA4.
 * - Sentry: none. The SDK is bundled, and events go through the same-origin
 *   /monitoring tunnel (`tunnelRoute` in next.config.ts).
 * - Modal: none. Only server actions call the optimizer, never the browser.
 *
 * `upgrade-insecure-requests` is only sent over https: on a plain-http
 * production server (`next start` on localhost, as Lighthouse CI runs it)
 * it would rewrite same-origin asset URLs to https and break the page.
 */
function buildCsp({ https }: { https: boolean }): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://*.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
    "font-src 'self'",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(https ? ['upgrade-insecure-requests'] : []),
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

  // --- CSP (production only) ---
  // Skipped in development: React's dev build needs eval(), which the
  // policy blocks, and dev servers run on plain http.
  const isDev = process.env.NODE_ENV === 'development'
  const requestHeaders = new Headers(req.headers)

  // Expose the pathname to server components (read via next/headers): the
  // gene not-found page recovers the requested symbol from it.
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  const csp = isDev
    ? undefined
    : buildCsp({ https: req.nextUrl.protocol === 'https:' })

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
