import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { authCopy } from './copy'
import { refuseUnconfigured, safeReturnTo } from './gate'
import {
  gateConfig,
  passcodeMatches,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from './session'

/**
 * `POST /api/login` and `POST /api/logout`: plain form posts from the login
 * page (src/routes/login.tsx), answered with 303 redirects, so signing in
 * works before any JavaScript has loaded.
 */

const log = createLogger('auth')

/** A passcode and a path; anything much bigger is not a sign-in. */
const MAX_BODY_BYTES = 8 * 1024

function seeOther(location: URL, cookie?: string): Response {
  const headers = new Headers({
    location: location.toString(),
    'cache-control': 'no-store',
  })
  if (cookie) headers.append('set-cookie', cookie)
  return new Response(null, { status: 303, headers })
}

function refuse(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: { 'cache-control': 'no-store' } },
  )
}

function cookie(url: URL, value: string, maxAge: number): string {
  // Secure everywhere but plain-http localhost, where browsers would drop it.
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

/**
 * A cross-site page could otherwise sign a visitor in under the shared
 * passcode (login CSRF). Browsers send Origin on every form POST.
 */
function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin')
  return origin === null || origin === url.origin
}

/**
 * Ten attempts a minute per address, on the LOGIN_LIMITER binding: room for
 * typos, nowhere near enough to guess a word.
 */
async function withinLoginBudget(
  request: Request,
  env: ServerEnv,
): Promise<boolean> {
  // Cloudflare sets the client's address on every request it serves. Without
  // one (local development and tests) there is no address to count, and one
  // shared bucket for everyone would only lock out the next test run.
  const address = request.headers.get('cf-connecting-ip')
  if (!env.LOGIN_LIMITER || !address) return true
  const { success } = await env.LOGIN_LIMITER.limit({ key: `login:${address}` })
  return success
}

export async function handleLogin(
  request: Request,
  env: ServerEnv,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { allow: 'POST' } })
  }
  const url = new URL(request.url)
  const config = gateConfig(env)
  const unconfigured = refuseUnconfigured(request, config)
  if (unconfigured) return unconfigured
  if (!sameOrigin(request, url)) return refuse(403, authCopy.crossOrigin)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return refuse(413, authCopy.badRequest)
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return refuse(400, authCopy.badRequest)
  }
  // A file where a text field belongs is malformed: read it as empty.
  const text = (name: string) => {
    const value = form.get(name)
    return typeof value === 'string' ? value : ''
  }
  const returnTo = safeReturnTo(text('return_to'), url.origin)

  // No passcode configured (local development): nothing to check.
  if (config.mode !== 'on') return seeOther(new URL(returnTo, url))

  // Back to the form, which says what went wrong (src/routes/login.tsx).
  const retry = (error: 'passcode' | 'limit') => {
    const location = new URL('/login', url)
    location.searchParams.set('error', error)
    if (returnTo !== '/') location.searchParams.set('return_to', returnTo)
    return seeOther(location)
  }
  if (!(await withinLoginBudget(request, env))) {
    log.warn('sign-in refused: attempt budget spent')
    return retry('limit')
  }
  if (!(await passcodeMatches(text('password'), config.password))) {
    log.info('sign-in refused: wrong passcode')
    return retry('passcode')
  }

  const token = await signSession(config)
  return seeOther(
    new URL(returnTo, url),
    cookie(url, token, SESSION_MAX_AGE_SECONDS),
  )
}

export function handleLogout(request: Request): Response {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { allow: 'POST' } })
  }
  const url = new URL(request.url)
  if (!sameOrigin(request, url)) return refuse(403, authCopy.crossOrigin)
  return seeOther(new URL('/login', url), cookie(url, '', 0))
}
