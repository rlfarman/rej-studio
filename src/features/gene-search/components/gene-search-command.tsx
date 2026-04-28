import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import Link from 'next/link'
import type { GeneSearchResult } from '@/features/gene-search/api/gene-queries'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { TruncatedText } from '@/components/truncated-text'
import { HighlightMatch } from '@/features/gene-search/utils/highlight-match'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  CircleAlert,
  ClockIcon,
  ExternalLink,
  Loader2,
  RefreshCwIcon,
  StarIcon,
  WandSparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DnaLoader } from '@/components/bio/dna-loader'
import type {
  SavedGene,
  JobSearchItem,
} from '@/features/gene-search/types/domain-types'
import { useSpeciesContext } from '@/stores/species-store'
import type { SpeciesFilter } from '@/lib/bio/species'
import { useIsMobile } from '@/hooks/use-mobile'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.command

const SPECIES_OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'both', label: copy.speciesOptions.all },
  { value: 'human', label: copy.speciesOptions.human },
  { value: 'mouse', label: copy.speciesOptions.mouse },
]

function SpeciesToggle() {
  const { species, handleSpeciesChange } = useSpeciesContext()

  return (
    <div className="flex gap-1 border-b px-3 py-2">
      {SPECIES_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => handleSpeciesChange(value)}
          aria-pressed={species === value}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            species === value
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
          }`}
        >
          <SpeciesIcon species={value} className="!size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Reveals `true` only after the input flag has been continuously `true` for
 * `delayMs`. Lets us defer rendering transient UI (like a loading indicator)
 * long enough that fast queries never flash it on screen.
 */
function useDelayedTrue(flag: boolean, delayMs: number) {
  const [delayed, setDelayed] = useState(false)
  const [prevFlag, setPrevFlag] = useState(flag)
  // Reset during render when flag flips so the delayed signal restarts from
  // scratch — React's documented pattern for "adjust state while rendering".
  if (prevFlag !== flag) {
    setPrevFlag(flag)
    setDelayed(false)
  }
  useEffect(() => {
    if (!flag) return
    const t = setTimeout(() => setDelayed(true), delayMs)
    return () => clearTimeout(t)
  }, [flag, delayMs])
  return delayed
}

interface GeneSearchInputProps {
  query: string
  setQuery: (query: string) => void
  hasSearched: boolean
  searchResults: GeneSearchResult[]
  isLoading: boolean
  setIsOpen: (isLoading: boolean) => void
  handleSelect: (gene: SavedGene) => void
  error: string | null
  retry: () => void
  recentGenes: SavedGene[]
  favoriteGenes: SavedGene[]
  jobs: JobSearchItem[]
  handleSelectJob: (entry: JobSearchItem) => void
  pendingGene?: SavedGene | null
}

function geneMatches(gene: SavedGene, q: string): boolean {
  if (!q) return true
  return (
    gene.symbol.toLowerCase().includes(q) ||
    gene.name.toLowerCase().includes(q) ||
    (gene.matchedIsoformId?.toLowerCase().includes(q) ?? false)
  )
}

function jobMatches(entry: JobSearchItem, q: string): boolean {
  if (!q) return true
  return entry.name.toLowerCase().includes(q)
}

interface SavedGeneRowProps {
  gene: SavedGene
  keyPrefix: 'fav' | 'recent'
  query: string
  leadingIcon: React.ReactNode
  onSelect: (gene: SavedGene) => void
}

function SavedGeneRow({
  gene,
  keyPrefix,
  query,
  leadingIcon,
  onSelect,
}: SavedGeneRowProps) {
  return (
    <CommandItem
      value={`${keyPrefix}-${gene.id}`}
      onSelect={() => onSelect(gene)}
    >
      {leadingIcon}
      {gene.species && (
        <SpeciesIcon
          species={gene.species}
          className="text-muted-foreground h-3.5 w-3.5"
        />
      )}
      <span className="font-mono font-medium">
        <HighlightMatch text={gene.symbol} query={query} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <TruncatedText
          tooltip={gene.name}
          className="text-muted-foreground truncate"
        >
          <HighlightMatch text={gene.name} query={query} />
        </TruncatedText>
        {gene.matchedIsoformId && (
          <span className="text-muted-foreground font-mono text-xs">
            {gene.matchedIsoformId}
          </span>
        )}
      </div>
    </CommandItem>
  )
}

interface JobRowProps {
  entry: JobSearchItem
  query: string
  onSelect: (entry: JobSearchItem) => void
}

function JobRow({ entry, query, onSelect }: JobRowProps) {
  const isRunning = entry.status === 'running'
  const isError = entry.status === 'failed' || entry.status === 'cancelled'
  return (
    <CommandItem value={`job-${entry.id}`} onSelect={() => onSelect(entry)}>
      {isRunning ? (
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      ) : isError ? (
        <CircleAlert className="text-destructive h-4 w-4" />
      ) : (
        <WandSparkles className="text-muted-foreground h-4 w-4" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TruncatedText tooltip={entry.name} className="truncate font-medium">
          <HighlightMatch text={entry.name} query={query} />
        </TruncatedText>
        <span className="text-muted-foreground truncate text-xs">
          {entry.sequenceLength
            ? `${entry.sequenceLength} bp · ${entry.status}`
            : entry.status}
        </span>
      </div>
    </CommandItem>
  )
}

export function GeneSearchCommand({
  query,
  setQuery,
  hasSearched,
  searchResults,
  isLoading,
  setIsOpen,
  handleSelect,
  error,
  retry,
  recentGenes,
  favoriteGenes,
  jobs,
  handleSelectJob,
  pendingGene,
}: GeneSearchInputProps) {
  const [showList, setShowList] = useState(true)
  const { species } = useSpeciesContext()
  const isMobile = useIsMobile()

  const internalHandleSelect = (gene: SavedGene) => {
    setShowList(false)
    handleSelect(gene)
  }

  const internalHandleSelectJob = (entry: JobSearchItem) => {
    setShowList(false)
    handleSelectJob(entry)
  }

  const trimmedQuery = query.trim().toLowerCase()
  const hasQuery = trimmedQuery.length > 0
  // When typing, show up to 10 per local group; when idle, show 3 as a compact
  // suggestion preview so the palette doesn't dominate the screen.
  const perGroupLimit = hasQuery ? 10 : 3

  const displayedFavorites = useMemo(() => {
    const speciesFiltered =
      species === 'both'
        ? favoriteGenes
        : favoriteGenes.filter((g) => g.species === species)
    return speciesFiltered
      .filter((g) => geneMatches(g, trimmedQuery))
      .slice(0, perGroupLimit)
  }, [favoriteGenes, species, trimmedQuery, perGroupLimit])

  const displayedRecents = useMemo(() => {
    const favIds = new Set(displayedFavorites.map((g) => g.id))
    const speciesFiltered =
      species === 'both'
        ? recentGenes
        : recentGenes.filter((g) => g.species === species)
    return speciesFiltered
      .filter((g) => !favIds.has(g.id) && geneMatches(g, trimmedQuery))
      .slice(0, perGroupLimit)
  }, [recentGenes, species, trimmedQuery, perGroupLimit, displayedFavorites])

  const displayedJobs = useMemo(
    () =>
      jobs.filter((j) => jobMatches(j, trimmedQuery)).slice(0, perGroupLimit),
    [jobs, trimmedQuery, perGroupLimit],
  )

  const displayedGeneResults = useMemo(() => {
    const seenIds = new Set([
      ...displayedFavorites.map((g) => g.id),
      ...displayedRecents.map((g) => g.id),
    ])
    return searchResults.filter((g) => !seenIds.has(g.id))
  }, [searchResults, displayedFavorites, displayedRecents])

  const hasFavoriteGenes = displayedFavorites.length > 0
  const hasRecentGenes = displayedRecents.length > 0
  const hasJobs = displayedJobs.length > 0
  const hasGeneResults = displayedGeneResults.length > 0
  const hasAnySuggestions = hasFavoriteGenes || hasRecentGenes || hasJobs
  const hasResults = hasAnySuggestions || hasGeneResults

  // Single-source state resolution. The key insight: while the user is
  // typing and waiting for the first query to settle, we keep showing
  // whatever was visible before (suggestions or prior results) rather
  // than blanking the body. With `keepPreviousData` in the hook,
  // `searchResults` stays populated across keystrokes, and `hasSearched`
  // only flips to true once a query has resolved at least once.
  //
  // A gene-search error only hides the whole panel when there's nothing
  // else to show. If the user has matching favorites/recents/jobs, we still
  // render those and surface the gene error inline.
  const content: 'error' | 'results' | 'no-results' | 'prompt' = hasResults
    ? 'results'
    : error
      ? 'error'
      : hasQuery && hasSearched && !isLoading
        ? 'no-results'
        : 'prompt'

  // Defer dimming the result list ~180ms so fast queries never flicker.
  const showLoader = useDelayedTrue(isLoading, 180)

  const isNavigating = Boolean(pendingGene)

  return (
    <Command
      className="rounded-lg border md:min-w-[450px]"
      shouldFilter={false}
    >
      <CommandInput
        id="search"
        aria-label={copy.inputAria}
        placeholder={isMobile ? copy.placeholderMobile : copy.placeholder}
        className="border-0 text-base ring-0 outline-0 focus:border-0 focus:ring-0 active:border-0 active:ring-0 sm:text-sm"
        value={isNavigating && pendingGene ? pendingGene.symbol : query}
        onValueChange={(q) => {
          setQuery(q)
          if (!showList) {
            setShowList(true)
          }
        }}
        disabled={isNavigating}
        autoFocus
      />
      {isNavigating && pendingGene ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-3 px-6 py-10"
        >
          <DnaLoader className="h-8 w-20" />
          <p className="text-muted-foreground text-sm">
            {copy.opening(pendingGene.symbol)}
          </p>
        </div>
      ) : (
        <SpeciesToggle />
      )}
      {!isNavigating && showList && (
        <>
          {content === 'error' && (
            <div className="text-destructive-foreground flex flex-col items-center gap-2 p-4 text-center text-sm">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={retry}
              >
                <RefreshCwIcon className="size-3" />
                {copy.retry}
              </Button>
            </div>
          )}
          {content === 'prompt' && (
            <div className="py-6 text-center text-sm transition-opacity duration-200">
              {copy.promptEmpty}
            </div>
          )}
          {content === 'no-results' && (
            <div className="py-6 text-center text-sm transition-opacity duration-200">
              {geneSearchCopy.results.noMatches(query)}{' '}
              <Link
                href="/design-tool"
                className="text-primary font-medium underline underline-offset-4"
                onClick={() => {
                  setIsOpen(false)
                  setShowList(false)
                }}
              >
                {geneSearchCopy.results.enterCustom}
              </Link>
            </div>
          )}

          {/* CommandList (role="listbox") only when there are CommandItem children. */}
          {content === 'results' && (
            <CommandList
              className={cn(
                'max-h-[300px] overflow-y-auto transition-opacity duration-200',
                // Dim the list while a fresh query is loading to telegraph
                // that newer results are on the way, without yanking the
                // current content out from under the user.
                showLoader && 'opacity-60',
              )}
            >
              {hasFavoriteGenes && (
                <CommandGroup heading={copy.favorites}>
                  {displayedFavorites.map((gene) => (
                    <SavedGeneRow
                      key={`fav-${gene.id}`}
                      gene={gene}
                      keyPrefix="fav"
                      query={query}
                      leadingIcon={
                        <StarIcon className="text-muted-foreground h-4 w-4" />
                      }
                      onSelect={internalHandleSelect}
                    />
                  ))}
                </CommandGroup>
              )}
              {hasRecentGenes && (
                <>
                  {hasFavoriteGenes && <CommandSeparator />}
                  <CommandGroup heading={copy.recentGenes}>
                    {displayedRecents.map((gene) => (
                      <SavedGeneRow
                        key={`recent-${gene.id}`}
                        gene={gene}
                        keyPrefix="recent"
                        query={query}
                        leadingIcon={
                          <ClockIcon className="text-muted-foreground h-4 w-4" />
                        }
                        onSelect={internalHandleSelect}
                      />
                    ))}
                  </CommandGroup>
                </>
              )}
              {hasJobs && (
                <>
                  {(hasFavoriteGenes || hasRecentGenes) && <CommandSeparator />}
                  <CommandGroup heading={copy.recentJobs}>
                    {displayedJobs.map((entry) => (
                      <JobRow
                        key={`job-${entry.id}`}
                        entry={entry}
                        query={query}
                        onSelect={internalHandleSelectJob}
                      />
                    ))}
                  </CommandGroup>
                </>
              )}
              {hasGeneResults && (
                <>
                  {hasAnySuggestions && <CommandSeparator />}
                  <CommandGroup heading={copy.genes}>
                    {displayedGeneResults.map((gene) => (
                      <CommandItem
                        key={gene.id}
                        value={gene.id}
                        onSelect={() => internalHandleSelect(gene)}
                      >
                        <SpeciesIcon
                          species={gene.species}
                          className="text-muted-foreground h-3.5 w-3.5"
                        />
                        <span className="font-mono font-medium">
                          <HighlightMatch text={gene.symbol} query={query} />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <TruncatedText
                            tooltip={gene.name}
                            className="text-muted-foreground truncate"
                          >
                            <HighlightMatch text={gene.name} query={query} />
                          </TruncatedText>
                          {gene.matchedIsoformId && (
                            <span className="text-muted-foreground font-mono text-xs">
                              {gene.matchedIsoformId}
                            </span>
                          )}
                        </div>
                        {gene.matchedIsoformId && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-7 px-2"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <Link
                              href={`/design-tool?isoform=${gene.matchedIsoformId}`}
                              aria-label={copy.customizeAria(
                                gene.matchedIsoformId,
                              )}
                              onClick={() => {
                                setIsOpen(false)
                                setShowList(false)
                              }}
                            >
                              {copy.customize}
                              <ExternalLink className="size-3.5" />
                            </Link>
                          </Button>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {error && !hasGeneResults && hasQuery && (
                <div className="text-destructive-foreground flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span>{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1.5 px-2 text-xs"
                    onClick={retry}
                  >
                    <RefreshCwIcon className="size-3" />
                    {copy.retry}
                  </Button>
                </div>
              )}
            </CommandList>
          )}
        </>
      )}
    </Command>
  )
}
