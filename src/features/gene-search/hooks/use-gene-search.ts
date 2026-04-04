import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import type { GeneSearchResult } from '@/features/gene-search/api/genes'
import type { SpeciesFilter } from '@/lib/bio/species'
import { useSpeciesContext } from '@/stores/species-store'

interface UseGeneSearchProps {
  searchGenes: (
    content: string,
    species?: SpeciesFilter,
  ) => Promise<GeneSearchResult[]>
  defaultQuery?: string
}

export function useGeneSearch({
  searchGenes,
  defaultQuery,
}: UseGeneSearchProps) {
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchResults, setSearchResults] = useState<GeneSearchResult[]>([])
  const [debouncedQuery] = useDebounce(query, 250)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { species } = useSpeciesContext()

  useEffect(() => {
    let current = true
    if (debouncedQuery.trim().length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initiating async fetch from debounced input
      setIsLoading(true)
      setError(null)
      searchGenes(debouncedQuery, species)
        .then((results) => {
          if (current) {
            setSearchResults(results)
            setHasSearched(true)
            setIsLoading(false)
          }
        })
        .catch(() => {
          if (current) {
            setError('Search failed. Please try again.')
            setIsLoading(false)
          }
        })
    } else {
      setSearchResults([])
      setHasSearched(false)
      setIsLoading(false)
      setError(null)
    }
    return () => {
      current = false
    }
  }, [debouncedQuery, searchGenes, species])

  return {
    query,
    setQuery,
    hasSearched,
    searchResults,
    isLoading,
    error,
  }
}
