import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpeciesIcon } from '@/components/bio/species-icon'
import type { SearchGenesResult } from '@/features/gene-search/types/search'
import {
  geneLink,
  searchPageLink,
} from '@/features/gene-search/utils/search-href'
import {
  isSpecies,
  SPECIES_DISPLAY_NAME,
  type SpeciesFilter,
} from '@/lib/bio/species'
import { HighlightMatch } from '@/features/gene-search/utils/highlight-match'
import {
  matchedField,
  matchedLabel,
} from '@/features/gene-search/utils/matched-field'
import { SearchEmptyState } from './search-empty-state'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.results
const pageCopy = geneSearchCopy.searchPage

/*
 * The /genes results list: what a search found, or what to try instead.
 */

export function SearchError({
  message,
  retry,
}: {
  message: string
  /** The retry control: refreshing the page or refetching in place. */
  retry: ReactNode
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive-foreground"
    >
      <span>
        {message} {copy.errorSuffix}
      </span>
      {retry}
    </div>
  )
}

interface GeneSearchResultsViewProps {
  query: string
  species: SpeciesFilter
  data: SearchGenesResult
  /** How many more rows "Show more" would add; 0 hides the control. */
  moreCount?: number
  onShowMore?: () => void
}

export function GeneSearchResultsView({
  query,
  species,
  data,
  moreCount = 0,
  onShowMore,
}: GeneSearchResultsViewProps) {
  const { results, truncated, total, suggestions } = data

  if (results.length === 0) {
    return (
      <SearchEmptyState
        query={query}
        speciesLabel={
          species === 'both' ? undefined : SPECIES_DISPLAY_NAME[species]
        }
        allSpeciesAction={
          species === 'both' ? undefined : (
            <Link
              {...searchPageLink(query, 'both')}
              className="rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {copy.searchAllSpecies}
            </Link>
          )
        }
        suggestions={suggestions}
      />
    )
  }

  return (
    <section aria-label={pageCopy.resultsTitle(query)}>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        {truncated
          ? pageCopy.truncated(results.length, total)
          : pageCopy.resultCount(results.length)}
      </p>
      <ul className="divide-y divide-border border-y">
        {results.map((gene) => {
          const match = matchedField(gene, query)
          const speciesName = isSpecies(gene.species)
            ? SPECIES_DISPLAY_NAME[gene.species]
            : gene.species
          return (
            <li
              key={gene.id}
              className="group/gene-row flex items-center gap-2 transition-colors hover:bg-accent/40"
            >
              <Link
                {...geneLink(gene.symbol, gene.species, gene.matchedIsoformId)}
                className="grid min-w-0 flex-1 grid-cols-[5rem_1fr] items-baseline gap-x-4 gap-y-1 rounded-xl px-2 py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:grid-cols-[7rem_1fr]"
              >
                <span className="truncate font-mono text-sm font-semibold">
                  <HighlightMatch text={gene.symbol} query={query} />
                </span>
                <span className="min-w-0 truncate text-sm">
                  <HighlightMatch text={gene.name} query={query} />
                </span>
                {/* One meta line: which species, and why this gene matched. */}
                <span className="col-start-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <SpeciesIcon
                    species={gene.species}
                    className="!size-3.5 shrink-0"
                  />
                  <span>{speciesName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{matchedLabel(match)}</span>
                </span>
              </Link>
              {gene.matchedIsoformId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  nativeButton={false}
                  render={
                    <Link
                      to="/design-tool"
                      search={{ isoform: gene.matchedIsoformId }}
                      aria-label={geneSearchCopy.command.customizeAria(
                        gene.matchedIsoformId,
                      )}
                    />
                  }
                >
                  <WandSparkles className="size-3.5" />
                  <span className="hidden sm:inline">
                    {geneSearchCopy.command.customize}
                  </span>
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {moreCount > 0 && onShowMore && (
        <Button
          variant="outline"
          className="mt-4 w-full sm:w-auto"
          aria-label={pageCopy.showMoreAria(moreCount)}
          onClick={onShowMore}
        >
          {pageCopy.showMore}
        </Button>
      )}
    </section>
  )
}

export function GeneSearchResultsLoading() {
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      {pageCopy.loading}
    </p>
  )
}
