import { z } from 'zod'
import { speciesFilterSchema } from '@/lib/bio/species'

/**
 * Search request/response shapes for the corpus search, used by the /genes
 * page and the command palette. Types and zod only.
 */

/** How many genes each surface shows. The palette stays compact. */
export const SEARCH_LIMITS = { palette: 6, page: 50 } as const

const searchRequestSchema = z.object({
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

/** One gene in a search result. */
export interface GeneSearchResult {
  id: string
  name: string
  symbol: string
  species: string
  /** Set when the query was a transcript id: the transcript it matched. */
  matchedIsoformId?: string
}

export interface GeneSearchPage {
  results: GeneSearchResult[]
  /** More genes matched than `limit`; the caller should say so. */
  truncated: boolean
}

// "Did you mean" only makes sense for something shaped like a symbol, not
// for a phrase such as a disease name.
const SYMBOL_LIKE = /^[\w.-]{2,20}$/

export function isSymbolLike(query: string): boolean {
  return SYMBOL_LIKE.test(query)
}

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
