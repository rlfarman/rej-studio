import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import type { GeneSearchResult } from '@/actions'
import { useSpeciesContext } from '@/context/species-context'

interface UseGeneSearchProps {
  searchGenes: (
    content: string,
    species?: string // Add species parameter
  ) => Promise<
    Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name' | 'species'>>
  >
  defaultQuery?: string
}

export function useGeneSearch({
  searchGenes,
  defaultQuery,
}: UseGeneSearchProps) {
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchResults, setSearchResults] = useState<
    Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name' | 'species'>>
  >([])
  const [debouncedQuery] = useDebounce(query, 250)
  const [isLoading, setIsLoading] = useState(false)

  const { species } = useSpeciesContext() // Use the species hook

  useEffect(() => {
    let current = true
    if (debouncedQuery.trim().length > 0) {
      setIsLoading(true)
      searchGenes(debouncedQuery, species).then((results) => {
        if (current) {
          setSearchResults(results)
          setHasSearched(true)
          setIsLoading(false)
        }
      })
    } else {
      setSearchResults([])
      setHasSearched(false)
      setIsLoading(false)
    }
    return () => {
      current = false
    }
  }, [debouncedQuery, searchGenes, species]) // Add species as a dependency

  return {
    query,
    setQuery,
    hasSearched,
    searchResults,
    isLoading,
  }
}
