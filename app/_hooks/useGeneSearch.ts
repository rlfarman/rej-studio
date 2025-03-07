import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import type { GeneSearchResult } from '@/actions'

interface UseGeneSearchProps {
  searchGenes: (
    content: string
  ) => Promise<Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>>>
  defaultQuery?: string
}

export function useGeneSearch({
  searchGenes,
  defaultQuery,
}: UseGeneSearchProps) {
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchResults, setSearchResults] = useState<
    Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>>
  >([])
  const [debouncedQuery] = useDebounce(query, 500)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let current = true
    if (debouncedQuery.trim().length > 0) {
      setIsLoading(true)
      searchGenes(debouncedQuery).then((results) => {
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
  }, [debouncedQuery, searchGenes])

  return {
    query,
    setQuery,
    hasSearched,
    searchResults,
    isLoading,
  }
}
