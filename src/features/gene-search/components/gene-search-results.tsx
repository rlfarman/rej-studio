import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SpeciesFilter } from '@/lib/bio/species'
import { geneSearchPageQuery } from '../corpus/queries'
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
  const { data, isError, refetch } = useQuery(
    geneSearchPageQuery(query, species),
  )

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
