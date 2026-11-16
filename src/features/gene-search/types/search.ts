import { z } from 'zod'
import { speciesFilterSchema } from '@/lib/bio/species'
import type { GeneSearchResult } from '@/features/gene-search/api/gene-queries'

/**
 * Search request/response shapes shared by the server (route handler, search
 * page) and the client (command palette). Client-safe: types and zod only.
 */

/** How many genes each surface shows. The palette stays compact. */
export const SEARCH_LIMITS = { palette: 6, page: 50 } as const

export const searchRequestSchema = z.object({
  q: z.string().max(200),
  species: speciesFilterSchema.default('both'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SEARCH_LIMITS.page)
    .default(SEARCH_LIMITS.palette),
})

export type SearchRequest = z.infer<typeof searchRequestSchema>

export interface SimilarGene {
  symbol: string
  species: string
}

export interface SearchGenesResult {
  results: GeneSearchResult[]
  /** More genes matched than were returned. */
  truncated: boolean
  /** "Did you mean" symbols, only filled in when nothing matched. */
  suggestions: SimilarGene[]
}

/** Body of every non-2xx response from GET /api/genes/search. */
export interface SearchErrorBody {
  error: string
}
