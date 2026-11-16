import {
  checkSearchRateLimit,
  searchGenes,
  SearchUnavailableError,
} from '@/features/gene-search/api/genes'
import {
  SEARCH_LIMITS,
  type SearchGenesResult,
} from '@/features/gene-search/types/search'
import { searchPageHref } from '@/features/gene-search/utils/search-href'
import {
  geneHref,
  isSpecies,
  SPECIES_DISPLAY_NAME,
  type SpeciesFilter,
} from '@/lib/bio/species'
import Link from 'next/link'
import { WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { HighlightMatch } from '@/features/gene-search/utils/highlight-match'
import {
  matchedField,
  type MatchedField,
} from '@/features/gene-search/utils/matched-field'
import { SearchRetryButton } from './search-retry-button'
import { SearchEmptyState } from './search-empty-state'
import { geneSearchCopy } from '../copy'
import { connection } from 'next/server'

const copy = geneSearchCopy.results
const pageCopy = geneSearchCopy.searchPage

interface GeneSearchResultsProps {
  query: string
  species: SpeciesFilter
}

function SearchError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="text-destructive-foreground bg-destructive/10 flex flex-col items-start gap-2 rounded-lg p-4 text-sm"
    >
      <span>
        {message} {copy.errorSuffix}
      </span>
      <SearchRetryButton />
    </div>
  )
}

/** Runs the search, mapping expected failures to a message. */
async function runSearch(
  query: string,
  species: SpeciesFilter,
): Promise<{ data: SearchGenesResult } | { error: string }> {
  const rateLimit = await checkSearchRateLimit()
  if (!rateLimit.ok) return { error: copy.rateLimited }
  try {
    return {
      data: await searchGenes({ q: query, species, limit: SEARCH_LIMITS.page }),
    }
  } catch (err) {
    if (err instanceof SearchUnavailableError) {
      return { error: geneSearchCopy.searchErrors.unavailable }
    }
    throw err
  }
}

function matchedLabel(match: MatchedField) {
  switch (match.kind) {
    case 'transcript':
      return copy.matched.transcript(match.id)
    case 'geneId':
      return copy.matched.geneId
    case 'symbol':
      return copy.matched.symbol
    case 'name':
      return copy.matched.name
    case 'alias':
      return copy.matched.alias
  }
}

export async function GeneSearchResults({
  query,
  species,
}: GeneSearchResultsProps) {
  // Searching rate-limits by wall-clock time (Date.now), so it must run at
  // request time; connection() marks that explicitly for Cache Components.
  await connection()
  const outcome = await runSearch(query, species)
  if ('error' in outcome) return <SearchError message={outcome.error} />

  const { results, truncated, suggestions } = outcome.data

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
              href={searchPageHref(query, 'both')}
              className="text-primary focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
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
      <p className="text-muted-foreground mb-2 text-sm" aria-live="polite">
        {truncated
          ? pageCopy.truncated(results.length)
          : pageCopy.resultCount(results.length)}
      </p>
      <ul className="divide-border divide-y border-y">
        {results.map((gene) => {
          const match = matchedField(gene, query)
          const speciesName = isSpecies(gene.species)
            ? SPECIES_DISPLAY_NAME[gene.species]
            : gene.species
          return (
            <li
              key={gene.id}
              className="group/gene-row hover:bg-accent/40 flex items-center gap-2 transition-colors"
            >
              <Link
                href={geneHref(
                  gene.symbol,
                  gene.species,
                  gene.matchedIsoformId,
                )}
                className="focus-visible:ring-ring grid min-w-0 flex-1 grid-cols-[5rem_1fr] items-baseline gap-x-4 gap-y-1 rounded-sm px-2 py-3 focus-visible:ring-2 focus-visible:outline-none sm:grid-cols-[7rem_1fr]"
              >
                <span className="truncate font-mono text-sm font-semibold">
                  <HighlightMatch text={gene.symbol} query={query} />
                </span>
                <span className="min-w-0 truncate text-sm">
                  <HighlightMatch text={gene.name} query={query} />
                </span>
                {/* One meta line: which species, and why this gene matched. */}
                <span className="text-muted-foreground col-start-2 flex min-w-0 items-center gap-1.5 text-xs">
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
                      href={`/design-tool?isoform=${gene.matchedIsoformId}`}
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
    </section>
  )
}

export function GeneSearchResultsLoading() {
  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      {pageCopy.loading}
    </p>
  )
}
