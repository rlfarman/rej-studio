import type { SpeciesFilter } from '@/lib/bio/species'

/**
 * Search request/response shapes for the corpus search, used by the /genes
 * page, the command palette and the MCP endpoint. Types and constants only:
 * the search worker imports this, so keep it free of runtime dependencies
 * such as zod.
 */

/** How many genes each surface shows. The palette stays compact. */
export const SEARCH_LIMITS = { palette: 6, page: 50 } as const

export interface SearchRequest {
  q: string
  species: SpeciesFilter
  /** At most `SEARCH_LIMITS.page`. */
  limit: number
}

/** One gene in a search result. */
export interface GeneSearchResult {
  id: string
  name: string
  symbol: string
  species: string
  /** Set when the query was a transcript id: the transcript it matched. */
  matchedIsoformId?: string
  /**
   * Which field the text search matched, and whether only as a close
   * spelling (a typo). Set by text search; absent for id lookups.
   */
  match?: { field: 'symbol' | 'alias' | 'name'; typo: boolean }
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
