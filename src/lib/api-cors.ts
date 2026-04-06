import { NextResponse } from 'next/server'
import { isAllowedOrigin } from '@/lib/allowed-origins'

/**
 * Add CORS headers to a NextResponse. Returns the origin if it's in the
 * allowlist, or omits the header (blocking cross-origin access).
 */
export function withCors(response: NextResponse, origin: string | null) {
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Vary', 'Origin')
  }
  return response
}
