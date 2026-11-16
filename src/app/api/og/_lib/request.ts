import { getClientIp } from '@/lib/client-ip'
import { createUpstashRateLimiter } from '@/lib/upstash'

// The OG routes are public (crawlers fetch them without a session) and each
// render costs CPU, plus a database lookup for gene images. Responses are
// CDN-cached for an hour, so legitimate unfurls rarely reach the function;
// this caps what one client can make it render.
const ogLimiter = createUpstashRateLimiter({
  prefix: 'og',
  maxRequests: 60,
  windowMs: 60_000,
})

/** A 429 response when the caller is over the limit, otherwise null. */
export async function rateLimitOgRequest(
  request: Request,
): Promise<Response | null> {
  const { ok, resetMs } = await ogLimiter.check(getClientIp(request.headers))
  if (ok) return null
  return new Response('Too Many Requests', {
    status: 429,
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(resetMs / 1000))) },
  })
}

/**
 * Query-string text for an OG image, trimmed and cut to `max` characters
 * (with an ellipsis) so a crafted URL can't render a wall of text.
 */
export function ogText(
  value: string | null,
  max: number,
  fallback = '',
): string {
  const chars = Array.from(value?.trim() || fallback)
  return chars.length > max
    ? `${chars.slice(0, max - 1).join('')}…`
    : chars.join('')
}

const SITE_LABEL = 'rejstudio.com'
// `rejstudio.com` plus an optional path of URL-safe characters.
const SITE_LABEL_PATTERN = /^rejstudio\.com(?:\/[\w\-/]{0,48})?$/

/**
 * The footer label: only this site's own address, so the image can't be
 * made to display another domain under the REJ Studio name.
 */
export function ogSiteLabel(value: string | null): string {
  return value && SITE_LABEL_PATTERN.test(value) ? value : SITE_LABEL
}
