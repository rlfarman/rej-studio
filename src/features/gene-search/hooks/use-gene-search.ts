import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { GeneSearchResult } from '@/features/gene-search/api/gene-queries'
import type { SearchGenesResult } from '@/features/gene-search/api/genes'
import type { SpeciesFilter } from '@/lib/bio/species'
import { useSpeciesContext } from '@/stores/species-store'
import { trackEvent } from '@/lib/analytics'

interface UseGeneSearchProps {
  searchGenes: (
    content: string,
    species?: SpeciesFilter,
  ) => Promise<SearchGenesResult>
  defaultQuery?: string
}

const EMPTY_RESULTS: GeneSearchResult[] = []

export function useGeneSearch({
  searchGenes,
  defaultQuery,
}: UseGeneSearchProps) {
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

  const { data, isFetching, isError, isPlaceholderData } = useQuery({
    queryKey: ['gene-search', trimmed, species],
    queryFn: () => searchGenes(trimmed, species),
    enabled,
    staleTime: 30_000,
    // Keep the previous query's results mounted while a new query loads, so
    // the list doesn't blank out between keystrokes. Pairs with a delayed
    // inline loader in the input to avoid flash-of-loading on fast queries.
    placeholderData: keepPreviousData,
  })

  // Track completed searches (fires once per unique query+species+results).
  const lastTrackedQuery = useRef('')
  useEffect(() => {
    if (!data || !trimmed || trimmed === lastTrackedQuery.current) return
    lastTrackedQuery.current = trimmed
    trackEvent({
      event: 'gene_search',
      query: trimmed,
      species,
      result_count: data.results.length,
    })
  }, [data, trimmed, species])

  // Distinguish between: network error (isError), server-side DB error
  // (data.error), and genuine empty results (data.results.length === 0).
  const error = isError
    ? 'Search failed. Please try again.'
    : (data?.error ?? null)

  const retry = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['gene-search', trimmed, species],
    })
  }, [queryClient, trimmed, species])

  const pendingQuery = query.trim()

  return {
    query,
    setQuery,
    searchNow,
    // True once the current query has its own results — not the previous
    // query's, which `keepPreviousData` keeps on screen while it loads.
    hasSearched: enabled && data !== undefined && !isPlaceholderData,
    searchResults: data?.results ?? EMPTY_RESULTS,
    // Covers the debounce window too, so the UI can show "Searching…" the
    // moment the user types instead of after the request starts.
    isLoading:
      pendingQuery.length > 0 && (pendingQuery !== trimmed || isFetching),
    error,
    retry,
  }
}
