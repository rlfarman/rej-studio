import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import {
  searchGenesClient,
  type GeneSearchResult,
} from '@/features/gene-search/utils/client-search'
import { useSpeciesContext } from '@/stores/species-store'
import { trackEvent } from '@/lib/analytics'

interface UseGeneSearchProps {
  defaultQuery?: string
}

const EMPTY_RESULTS: GeneSearchResult[] = []

export function useGeneSearch({ defaultQuery }: UseGeneSearchProps = {}) {
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [debouncedQuery] = useDebounce(query, 250)
  const { species } = useSpeciesContext()

  const trimmed = debouncedQuery.trim()
  const enabled = trimmed.length > 0

  const [results, setResults] = useState<GeneSearchResult[]>(EMPTY_RESULTS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const runIdRef = useRef(0)

  const runSearch = useCallback(async () => {
    const runId = ++runIdRef.current
    if (!enabled) {
      setResults(EMPTY_RESULTS)
      setIsLoading(false)
      setError(null)
      setHasSearched(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const out = await searchGenesClient(trimmed, species)
      if (runId !== runIdRef.current) return
      setResults(out)
      setHasSearched(true)
      setIsLoading(false)
    } catch (err) {
      if (runId !== runIdRef.current) return
      setError('Search is temporarily unavailable.')
      setIsLoading(false)
      setHasSearched(true)
      // Surface to console so devtools shows the underlying cause.
      console.error('[gene-search]', err)
    }
  }, [enabled, trimmed, species])

  useEffect(() => {
    runSearch()
  }, [runSearch])

  // Track completed searches (fires once per unique query+species+results).
  const lastTrackedQuery = useRef('')
  useEffect(() => {
    if (!hasSearched || !trimmed || trimmed === lastTrackedQuery.current) return
    lastTrackedQuery.current = trimmed
    trackEvent({
      event: 'gene_search',
      query: trimmed,
      species,
      result_count: results.length,
    })
  }, [hasSearched, results, trimmed, species])

  const retry = useCallback(() => {
    runSearch()
  }, [runSearch])

  return {
    query,
    setQuery,
    hasSearched: enabled && hasSearched,
    searchResults: results,
    isLoading: enabled && isLoading,
    error,
    retry,
  }
}
