import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SpeciesFilter } from '@/lib/bio/species'
import { geneSearchPageQuery } from '../corpus/queries'
import { SEARCH_LIMITS } from '../types/search'
import { geneSearchCopy } from '../copy'
import {
  GeneSearchResultsLoading,
  GeneSearchResultsView,
  SearchError,
} from './gene-search-results-view'

interface GeneSearchResultsProps {
  query: string
  species: SpeciesFilter
}

/**
 * The /genes results, searched in the browser against the static corpus's
 * index (downloaded once, then shared with the palette). The route loader
 * usually has them in the cache already; a failed search is retried in
 * place rather than taking the page down.
 */
export function GeneSearchResults({ query, species }: GeneSearchResultsProps) {
  // How many rows this search is showing. "Show more" raises it, and the
  // raise is remembered against the search it was made for, so a new query
  // starts at the first page without a reset effect.
  const searchKey = `${query}/${species}`
  const [shown, setShown] = useState({
    key: searchKey,
    limit: SEARCH_LIMITS.page as number,
  })
  const limit = shown.key === searchKey ? shown.limit : SEARCH_LIMITS.page
  const nextLimit = Math.min(limit * 2, SEARCH_LIMITS.pageMax)

  const { data, isError, isPlaceholderData, refetch } = useQuery({
    ...geneSearchPageQuery(query, species, limit),
    // Keep the rows on screen while a larger page is ranked, so "Show more"
    // extends the list instead of blanking it.
    placeholderData: keepPreviousData,
  })

  if (isError) {
    return (
      <SearchError
        message={geneSearchCopy.searchErrors.unavailable}
        retry={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => void refetch()}
          >
            <RefreshCwIcon className="size-3" />
            {geneSearchCopy.command.retry}
          </Button>
        }
      />
    )
  }
  if (!data) return <GeneSearchResultsLoading />
  return (
    <GeneSearchResultsView
      query={query}
      species={species}
      data={data}
      // Each click roughly doubles the page, to a ceiling: a few clicks
      // reach every match of a family query without ten rounds of 50.
      moreCount={
        data.truncated && limit < SEARCH_LIMITS.pageMax && !isPlaceholderData
          ? Math.min(data.total, nextLimit) - data.results.length
          : 0
      }
      onShowMore={() => setShown({ key: searchKey, limit: nextLimit })}
    />
  )
}
