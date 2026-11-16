import {
  checkSearchRateLimit,
  searchGenes,
  SearchUnavailableError,
} from '@/features/gene-search/api/genes'
import {
  SEARCH_LIMITS,
  type SearchGenesResult,
} from '@/features/gene-search/types/search'
import type { SpeciesFilter } from '@/lib/bio/species'
import { connection } from 'next/server'
import { geneDataUrl } from '../corpus/gene-data-url'
import { BrowserGeneSearchResults } from './browser-gene-search-results'
import { GeneSearchResultsView, SearchError } from './gene-search-results-view'
import { SearchRetryButton } from './search-retry-button'
import { geneSearchCopy } from '../copy'

export { GeneSearchResultsLoading } from './gene-search-results-view'

const copy = geneSearchCopy.results

interface GeneSearchResultsProps {
  query: string
  species: SpeciesFilter
}

/** Runs the search, mapping expected failures to a message. */
async function runSearch(
  query: string,
  species: SpeciesFilter,
): Promise<{ data: SearchGenesResult } | { error: string }> {
  const rateLimit = await checkSearchRateLimit()
  if (!rateLimit.ok) return { error: copy.rateLimited }
  try {
    return {
      data: await searchGenes({ q: query, species, limit: SEARCH_LIMITS.page }),
    }
  } catch (err) {
    if (err instanceof SearchUnavailableError) {
      return { error: geneSearchCopy.searchErrors.unavailable }
    }
    throw err
  }
}

/**
 * The /genes results. With a static corpus the search runs in the browser;
 * otherwise (production on Postgres) it runs here, behind the rate limit.
 */
export async function GeneSearchResults({
  query,
  species,
}: GeneSearchResultsProps) {
  if (geneDataUrl()) {
    return <BrowserGeneSearchResults query={query} species={species} />
  }

  // Searching rate-limits by wall-clock time (Date.now), so it must run at
  // request time; connection() marks that explicitly for Cache Components.
  await connection()
  const outcome = await runSearch(query, species)
  if ('error' in outcome) {
    return <SearchError message={outcome.error} retry={<SearchRetryButton />} />
  }
  return (
    <GeneSearchResultsView
      query={query}
      species={species}
      data={outcome.data}
    />
  )
}
