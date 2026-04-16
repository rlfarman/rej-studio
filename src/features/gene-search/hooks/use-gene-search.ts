import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { GeneSearchResult } from '@/features/gene-search/api/gene-queries'
import type { SearchGenesResult } from '@/features/gene-search/api/genes'
import type { SpeciesFilter } from '@/lib/bio/species'
import { useSpeciesContext } from '@/stores/species-store'
import { trackEvent } from '@/lib/analytics'
import { geneSearchCopy } from '@/features/gene-search/copy'

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
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [debouncedQuery] = useDebounce(query, 250)
  const { species } = useSpeciesContext()

  const trimmed = debouncedQuery.trim()
  const enabled = trimmed.length > 0

  const { data, isFetching, isError } = useQuery({
    queryKey: ['gene-search', trimmed, species],
    queryFn: () => searchGenes(trimmed, species),
    enabled,
    staleTime: 30_000,
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
    ? geneSearchCopy.search.errors.failed
    : (data?.error ?? null)

  const retry = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['gene-search', trimmed, species],
    })
  }, [queryClient, trimmed, species])

  return {
    query,
    setQuery,
    hasSearched: enabled && data !== undefined,
    searchResults: data?.results ?? EMPTY_RESULTS,
    isLoading: enabled && isFetching,
    error,
    retry,
  }
}
