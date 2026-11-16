'use client'

import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SpeciesFilter } from '@/lib/bio/species'
import { SEARCH_LIMITS } from '@/features/gene-search/types/search'
import { searchCorpus } from '../corpus/client'
import { getBrowserCorpus } from '../corpus/gene-data-url'
import { geneSearchCopy } from '../copy'
import {
  GeneSearchResultsLoading,
  GeneSearchResultsView,
  SearchError,
} from './gene-search-results-view'

interface BrowserGeneSearchResultsProps {
  query: string
  species: SpeciesFilter
}

/**
 * The /genes results, searched in the browser against the static corpus's
 * index (downloaded once, then shared with the palette). The server renders
 * the loading state; results appear once the index is in.
 */
export function BrowserGeneSearchResults({
  query,
  species,
}: BrowserGeneSearchResultsProps) {
  const { data, isError, refetch } = useQuery({
    queryKey: ['gene-search-page', query, species],
    queryFn: () => {
      const corpus = getBrowserCorpus()
      if (!corpus) throw new Error('No static gene corpus configured')
      return searchCorpus(corpus, {
        q: query,
        species,
        limit: SEARCH_LIMITS.page,
      })
    },
    staleTime: Infinity,
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
  return <GeneSearchResultsView query={query} species={species} data={data} />
}
