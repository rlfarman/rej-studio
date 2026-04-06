import { useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useQuery } from '@tanstack/react-query'
import type { GeneSearchResult } from '@/features/gene-search/api/genes'
import type { SpeciesFilter } from '@/lib/bio/species'
import { useSpeciesContext } from '@/stores/species-store'
import { trackEvent } from '@/lib/analytics'

interface UseGeneSearchProps {
  searchGenes: (
    content: string,
    species?: SpeciesFilter,
  ) => Promise<GeneSearchResult[]>
  defaultQuery?: string
}

const EMPTY_RESULTS: GeneSearchResult[] = []

export function useGeneSearch({
  searchGenes,
  defaultQuery,
}: UseGeneSearchProps) {
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
      result_count: data.length,
    })
  }, [data, trimmed, species])

  return {
    query,
    setQuery,
    hasSearched: enabled && data !== undefined,
    searchResults: data ?? EMPTY_RESULTS,
    isLoading: enabled && isFetching,
    error: isError ? 'Search failed. Please try again.' : null,
  }
}
