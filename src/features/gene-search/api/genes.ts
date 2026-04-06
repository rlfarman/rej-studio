'use server'

import {
  fetchGenesBySearch,
  fetchGeneBySymbol,
} from '@/features/gene-search/api/gene-queries'
import type { GeneSearchResult } from '@/features/gene-search/api/gene-queries'
import { speciesFilterSchema, type SpeciesFilter } from '@/lib/bio/species'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createRateLimiter } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

export type { GeneSearchResult }

const log = createLogger('gene-search')

// 30 searches per minute per IP. Generous for normal use but caps automated
// scraping that would hammer the Neon DB.
const searchLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })

// Defense-in-depth: server actions are reachable from any caller (client, other
// server code), so re-validate inputs at the boundary even though call-sites
// pass typed values. A hostile client can construct arbitrary payloads.
const searchGenesInput = z.object({
  query: z.string().max(200),
  species: speciesFilterSchema.default('both'),
})

const geneSymbolInput = z.object({
  symbol: z.string().min(1).max(100),
  species: speciesFilterSchema.optional(),
})

export async function searchGenes(
  query: string,
  species: SpeciesFilter = 'both',
): Promise<GeneSearchResult[]> {
  const parsed = searchGenesInput.parse({ query, species })
  const trimmedQuery = parsed.query.trim()
  if (trimmedQuery.length === 0) return []

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { ok: allowed } = searchLimiter.check(ip)
  if (!allowed) {
    throw new Error('Too many search requests. Please wait a moment.')
  }

  try {
    const results = await fetchGenesBySearch(trimmedQuery, parsed.species)
    // Structured search analytics — log query, species filter, and result
    // count so we can understand what users search for. No PII (IP is not
    // included); the query itself is gene/disease terminology, not personal.
    log.info('search', {
      query: trimmedQuery,
      species: parsed.species,
      resultCount: results.length,
    })
    return results
  } catch (err) {
    log.error('search query failed', err, { query: trimmedQuery })
    // Return empty results instead of crashing — the UI shows "no results"
    // which is better than an error boundary for transient DB issues.
    return []
  }
}

export async function getGeneBySymbol(symbol: string, species?: SpeciesFilter) {
  const parsed = geneSymbolInput.parse({ symbol, species })
  return fetchGeneBySymbol(parsed.symbol, parsed.species)
}
