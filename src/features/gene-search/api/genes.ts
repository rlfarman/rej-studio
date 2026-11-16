import 'server-only'
import {
  fetchGenesBySearch,
  fetchGeneBySymbol,
  fetchSimilarGenes,
} from '@/features/gene-search/api/gene-queries'
import {
  isSymbolLike,
  type SearchGenesResult,
  type SearchRequest,
  type SimilarGene,
} from '@/features/gene-search/types/search'
import { speciesFilterSchema, type SpeciesFilter } from '@/lib/bio/species'
import { z } from 'zod'
import { getRequestRateLimitKey } from '@/lib/client-ip'
import { createUpstashRateLimiter } from '@/lib/upstash'
import { createLogger } from '@/lib/logger'

// Server-only reads. Nothing here is a server action: pages call these
// directly, and with Postgres behind them the command palette searches
// through GET /api/genes/search. With a static corpus the palette and the
// /genes page search in the browser instead (corpus/client.ts), so the
// rate limit below only guards the Postgres path.

const log = createLogger('gene-search')

// 30 searches per minute per IP. Generous for normal use but caps automated
// scraping that would hammer the Neon DB.
const searchLimiter = createUpstashRateLimiter({
  prefix: 'search',
  maxRequests: 30,
  windowMs: 60_000,
})

const geneSymbolInput = z.object({
  symbol: z.string().min(1).max(100),
  species: speciesFilterSchema.optional(),
})

/** Thrown when the search query itself fails (database down, etc.). */
export class SearchUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Gene search is unavailable.', options)
    this.name = 'SearchUnavailableError'
  }
}

export type RateLimitOutcome =
  { ok: true } | { ok: false; retryAfterSeconds: number }

/** Spend one search from the caller's per-IP budget. */
export async function checkSearchRateLimit(): Promise<RateLimitOutcome> {
  // Per session when signed in (a lab shares one IP), otherwise per IP.
  const { ok: allowed, resetMs } = await searchLimiter.check(
    await getRequestRateLimitKey(),
  )
  if (!allowed) {
    return { ok: false, retryAfterSeconds: Math.ceil(resetMs / 1000) }
  }
  return { ok: true }
}

/**
 * Search genes by symbol, name, alias or Ensembl ID. Expects input already
 * validated against `searchRequestSchema`. Throws `SearchUnavailableError`
 * when the database query fails, so callers can tell "no matches" apart
 * from "search is broken".
 */
export async function searchGenes({
  q,
  species,
  limit,
}: SearchRequest): Promise<SearchGenesResult> {
  const query = q.trim()
  if (query.length === 0) {
    return { results: [], truncated: false, suggestions: [] }
  }

  try {
    const { results, truncated } = await fetchGenesBySearch(
      query,
      species,
      limit,
    )
    const suggestions =
      results.length === 0 && isSymbolLike(query)
        ? await findSimilarGenes(query)
        : []
    // Structured search analytics — log query, species filter, and result
    // count so we can understand what users search for. No PII (IP is not
    // included); the query itself is gene/disease terminology, not personal.
    log.info('search', {
      query,
      species,
      resultCount: results.length,
      truncated,
    })
    return { results, truncated, suggestions }
  } catch (err) {
    log.error('search query failed', err, { query })
    throw new SearchUnavailableError({ cause: err })
  }
}

export async function getGeneBySymbol(symbol: string, species?: SpeciesFilter) {
  const parsed = geneSymbolInput.parse({ symbol, species })
  return fetchGeneBySymbol(parsed.symbol, parsed.species)
}

/**
 * Find genes with symbols similar to the given input, for "did you mean?"
 * suggestions on the 404 page and on empty searches. Never throws: a
 * suggestion lookup failing shouldn't take the page down with it.
 */
export async function findSimilarGenes(symbol: string): Promise<SimilarGene[]> {
  const cleaned = symbol.trim().toLowerCase().slice(0, 20)
  if (cleaned.length === 0) return []

  try {
    return await fetchSimilarGenes(cleaned)
  } catch (err) {
    log.warn('similar-gene lookup failed', {
      symbol: cleaned,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
