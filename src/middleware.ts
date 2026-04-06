import { NextRequest, NextResponse } from 'next/server'

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

// --- CSRF: Origin validation for mutating requests --------------------------
// Next.js server actions use POST. Reject cross-origin POSTs that don't come
// from our own domains. This is defense-in-depth on top of Next.js's built-in
// Origin check (which only validates server actions, not API routes).

const ALLOWED_ORIGINS = new Set([
  'https://rejstudio.com',
  'https://rej-studio.vercel.app',
  'https://rej-studio.rejstudio.workers.dev',
])

if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.add('http://localhost:3000')
  ALLOWED_ORIGINS.add('http://127.0.0.1:3000')
}

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true
  if (/^https:\/\/rej-studio-[\w-]+\.vercel\.app$/.test(origin)) return true
  if (/^https:\/\/[\w-]+-rej-studio\.rejstudio\.workers\.dev$/.test(origin))
    return true
  return false
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://*.sentry.io`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.sentry.io https://www.google-analytics.com https://*.modal.run",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export async function middleware(req: NextRequest) {
  // --- CSRF check (mutating requests) ---
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin')
    if (origin && !isAllowedOrigin(origin)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // --- CSP nonce (all routes) ---
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  // --- Basic auth (landing page only) ---
  const { pathname } = req.nextUrl
  const needsAuth = pathname === '/' || pathname === '/index'

  if (
    needsAuth &&
    !(
      process.env.NODE_ENV === 'development' &&
      process.env.BYPASS_AUTH === 'true'
    )
  ) {
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
      const url = req.nextUrl.clone()
      url.pathname = '/api/auth'
      const response = NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      })
      response.headers.set('Content-Security-Policy', csp)
      return response
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}
