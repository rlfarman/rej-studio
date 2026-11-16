import type { NextRequest } from 'next/server'
import { isAuthGateActive } from '@/lib/auth/gate'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'
import {
  checkSearchRateLimit,
  searchGenes,
  SearchUnavailableError,
} from '@/features/gene-search/api/genes'
import {
  searchRequestSchema,
  type SearchErrorBody,
  type SearchGenesResult,
} from '@/features/gene-search/types/search'
import { geneSearchCopy } from '@/features/gene-search/copy'

const copy = geneSearchCopy.searchErrors

// TanStack Query caches results in the palette; the browser shouldn't, since
// the answer depends on the session.
const NO_STORE = { 'Cache-Control': 'private, no-store' }

function errorResponse(
  status: number,
  error: string,
  headers?: Record<string, string>,
) {
  const body: SearchErrorBody = { error }
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } })
}

/**
 * GET /api/genes/search?q=&species=&limit=
 *
 * The command palette's as-you-type search. A route handler rather than a
 * server action: Next runs actions one at a time per client, so keystroke
 * searches queued behind job polls, and a fetch can be aborted when the
 * query changes. Expected failures come back as `{ error }` JSON with a
 * status code, since production masks thrown errors.
 */
export async function GET(request: NextRequest): Promise<Response> {
  // The proxy gates /api/*, but this handler is still a public endpoint, so
  // it checks the session itself rather than trusting the matcher.
  if (
    isAuthGateActive() &&
    !(await verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value))
  ) {
    return errorResponse(401, copy.unauthenticated)
  }

  const params = request.nextUrl.searchParams
  const parsed = searchRequestSchema.safeParse({
    q: params.get('q') ?? '',
    species: params.get('species') ?? undefined,
    limit: params.get('limit') ?? undefined,
  })
  if (!parsed.success) return errorResponse(400, copy.invalid)

  if (parsed.data.q.trim() === '') {
    const empty: SearchGenesResult = {
      results: [],
      truncated: false,
      suggestions: [],
    }
    return Response.json(empty, { headers: NO_STORE })
  }

  const rateLimit = await checkSearchRateLimit()
  if (!rateLimit.ok) {
    return errorResponse(429, copy.rateLimited(rateLimit.retryAfterSeconds), {
      'Retry-After': String(rateLimit.retryAfterSeconds),
    })
  }

  try {
    const body: SearchGenesResult = await searchGenes(parsed.data)
    return Response.json(body, { headers: NO_STORE })
  } catch (err) {
    if (err instanceof SearchUnavailableError) {
      return errorResponse(503, copy.unavailable)
    }
    throw err
  }
}
