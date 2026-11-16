import { cookies, headers as requestHeaders } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'

// Plain IPv4 or IPv6 text. Anything else (ports, brackets, junk a client put
// in a header) is ignored rather than used as a rate-limit key.
const IP_PATTERN = /^[0-9a-f.:]{2,45}$/i

function asIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && IP_PATTERN.test(trimmed) ? trimmed : null
}

/**
 * Best-effort client IP for rate limiting.
 *
 * On Vercel the platform sets `x-vercel-forwarded-for` / `x-real-ip` itself
 * and overwrites any value the client sent, so those are trusted there (the
 * Vercel header first: it survives another proxy in front of Vercel).
 *
 * Anywhere else (Docker behind a reverse proxy), only the right-most
 * `x-forwarded-for` entry is trusted: it was appended by the proxy directly
 * in front of us. Entries to its left came from the client and can be
 * forged, so taking the first one let anyone pick their own rate-limit key.
 *
 * Returns `'unknown'` when nothing usable is present, which puts all such
 * callers in one shared bucket.
 */
export function getClientIp(headers: Headers): string {
  if (process.env.VERCEL === '1') {
    const platformIp =
      asIp(headers.get('x-vercel-forwarded-for')?.split(',')[0]) ??
      asIp(headers.get('x-real-ip'))
    if (platformIp) return platformIp
  }

  const forwarded = headers.get('x-forwarded-for')?.split(',')
  return asIp(forwarded?.at(-1)) ?? asIp(headers.get('x-real-ip')) ?? 'unknown'
}

/**
 * Rate-limit key for a request: the session id for signed-in callers, the
 * client IP otherwise.
 *
 * Everyone in a lab usually shares one public IP, so keying signed-in work
 * by IP let one person's burst lock out their colleagues. Sessions are
 * signed, so the id can't be forged; minting new ones means signing in
 * again, which the login route rate-limits by IP.
 */
export async function getRateLimitKey(
  headers: Headers,
  sessionCookie: string | undefined,
): Promise<string> {
  const session = await verifySession(sessionCookie)
  return session ? `sid:${session.sid}` : `ip:${getClientIp(headers)}`
}

/**
 * {@link getRateLimitKey} for the current request, for server actions and
 * route handlers that don't hold the request object.
 */
export async function getRequestRateLimitKey(): Promise<string> {
  const [h, c] = await Promise.all([requestHeaders(), cookies()])
  return getRateLimitKey(h, c.get(SESSION_COOKIE_NAME)?.value)
}
