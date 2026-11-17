import { useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { GeneSearchResult } from '@/features/gene-search/types/search'
import {
  SEARCH_LIMITS,
  type SearchGenesResult,
  type SimilarGene,
} from '@/features/gene-search/types/search'
import type { SpeciesFilter } from '@/lib/bio/species'
import { useSpeciesContext } from '@/stores/species-store'
import { trackEvent } from '@/lib/analytics'
import { geneSearchCopy } from '../copy'
import { searchCorpus } from '../corpus/client'
import { getBrowserCorpus } from '../corpus/gene-data-url'

interface UseGeneSearchProps {
  defaultQuery?: string
}

const EMPTY_RESULTS: GeneSearchResult[] = []
const EMPTY_SUGGESTIONS: SimilarGene[] = []

/**
 * Run one palette search, right here against the corpus index (downloaded
 * once and shared with the rest of the app), so there is no request per
 * keystroke. A failure to fetch the index rejects, which the palette
 * reports as a network error.
 */
function searchPalette(
  query: string,
  species: SpeciesFilter,
): Promise<SearchGenesResult> {
  return searchCorpus(getBrowserCorpus(), {
    q: query,
    species,
    limit: SEARCH_LIMITS.palette,
  })
}

export function useGeneSearch({ defaultQuery }: UseGeneSearchProps = {}) {
  const queryClient = useQueryClient()
  const [query, setQueryState] = useState(defaultQuery ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(defaultQuery ?? '')
  const debounce = useDebouncedCallback(setDebouncedQuery, 250)
  const { species } = useSpeciesContext()

  const setQuery = (next: string) => {
    setQueryState(next)
    debounce(next)
  }

  // For a picked value (an example gene) there are no further keystrokes to
  // wait for, so skip the debounce and search right away.
  const searchNow = (next: string) => {
    debounce.cancel()
    setQueryState(next)
    setDebouncedQuery(next)
  }

  const trimmed = debouncedQuery.trim()
  const enabled = trimmed.length > 0
  const queryKey = ['gene-search', trimmed, species] as const

  const { data, isFetching, isError, isPlaceholderData } = useQuery({
    queryKey,
    queryFn: () => searchPalette(trimmed, species),
    enabled,
    // The corpus doesn't change under an open page.
    staleTime: Infinity,
    // Keep the previous query's results mounted while a new query loads, so
    // the list doesn't blank out between keystrokes. Pairs with a delayed
    // inline loader in the input to avoid flash-of-loading on fast queries.
    placeholderData: keepPreviousData,
  })

  // Track completed searches (fires once per unique query+species+results).
  const lastTrackedQuery = useRef('')
  useEffect(() => {
    if (!data || !trimmed) return
    if (trimmed === lastTrackedQuery.current) return
    lastTrackedQuery.current = trimmed
    trackEvent({
      event: 'gene_search',
      query: trimmed,
      species,
      result_count: data.results.length,
    })
  }, [data, trimmed, species])

  // A failed search (the index didn't load) versus genuinely no results.
  const error = isError ? geneSearchCopy.searchErrors.network : null

  // Fire and forget: a failed refetch surfaces through the query's isError,
  // read above, and invalidateQueries does not reject unless asked to
  // (throwOnError).
  const retry = () => {
    void queryClient.invalidateQueries({ queryKey })
  }

  const pendingQuery = query.trim()

  return {
    query,
    setQuery,
    searchNow,
    // True once the current query has its own results — not the previous
    // query's, which `keepPreviousData` keeps on screen while it loads.
    hasSearched: enabled && data !== undefined && !isPlaceholderData,
    searchResults: data?.results ?? EMPTY_RESULTS,
    truncated: data?.truncated ?? false,
    suggestions: data?.suggestions ?? EMPTY_SUGGESTIONS,
    // Covers the debounce window too, so the UI can show "Searching…" the
    // moment the user types instead of after the request starts.
    isLoading:
      pendingQuery.length > 0 && (pendingQuery !== trimmed || isFetching),
    error,
    retry,
  }
}
