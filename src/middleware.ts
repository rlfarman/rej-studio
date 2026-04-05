import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}

export function middleware(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const password = process.env.BASIC_AUTH_PASSWORD

  // If credentials are not configured, skip auth.
  if (!user || !password) {
    return NextResponse.next()
  }

  const header = request.headers.get('authorization')

  if (header) {
    const [scheme, encoded] = header.split(' ')
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded)
      const sep = decoded.indexOf(':')
      if (sep !== -1) {
        const providedUser = decoded.slice(0, sep)
        const providedPassword = decoded.slice(sep + 1)
        if (providedUser === user && providedPassword === password) {
          return NextResponse.next()
        }
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="REJ Studio", charset="UTF-8"',
    },
  })
}
