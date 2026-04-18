import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  timingSafeEqual,
} from '@/lib/auth/session'
import { createUpstashRateLimiter } from '@/lib/upstash'

const loginLimiter = createUpstashRateLimiter({
  prefix: 'login',
  maxRequests: 5,
  windowMs: 60_000,
})

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return '/'
  // Only allow internal paths to prevent open redirects.
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/'
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { ok } = await loginLimiter.check(ip)
  if (!ok) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  const form = await req.formData()
  const password = String(form.get('password') ?? '')
  const returnTo = safeReturnTo(String(form.get('return_to') ?? ''))

  const expected = process.env.BASIC_AUTH_PASSWORD
  if (!expected) {
    return new NextResponse('Auth not configured', { status: 500 })
  }

  const matches = await timingSafeEqual(password, expected)
  if (!matches) {
    const url = new URL('/login', req.url)
    url.searchParams.set('error', '1')
    if (returnTo !== '/') url.searchParams.set('return_to', returnTo)
    return NextResponse.redirect(url, { status: 303 })
  }

  const token = await signSession()
  const response = NextResponse.redirect(new URL(returnTo, req.url), {
    status: 303,
  })
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return response
}
