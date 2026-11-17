import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Link } from '@tanstack/react-router'
import type { GeneSearchResult } from '@/features/gene-search/types/search'
import type { SimilarGene } from '@/features/gene-search/types/search'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { TruncatedText } from '@/components/truncated-text'
import { HighlightMatch } from '@/features/gene-search/utils/highlight-match'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  CircleAlert,
  ClockIcon,
  ArrowRight,
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
import { SPECIES_DISPLAY_NAME, type SpeciesFilter } from '@/lib/bio/species'
import { useIsMobile } from '@/hooks/use-mobile'
import { geneSearchCopy } from '../copy'
import { SearchEmptyState } from './search-empty-state'
import { SearchShortcutHint } from '@/components/search-shortcut'
import { SEARCH_SHORTCUT_ARIA } from '@/lib/search-shortcut'

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
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
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
 * First-run hint inside the empty palette: a few well-known genes to try,
 * instead of a sentence that restates the placeholder. Picking one searches
 * for it right away (so the results show how search works) and returns focus
 * to the input so arrow keys reach the results.
 */
function ExampleGenes({ onPick }: { onPick: (symbol: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-3 text-sm">
      <span className="mr-1 text-muted-foreground">{copy.examplesLabel}</span>
      <ul className="flex flex-wrap gap-2" aria-label={copy.examplesAria}>
        {geneSearchCopy.exampleGenes.map((symbol) => (
          <li key={symbol}>
            <button
              type="button"
              aria-label={copy.exampleAria(symbol)}
              onClick={(e) => {
                onPick(symbol)
                e.currentTarget
                  .closest('[cmdk-root]')
                  ?.querySelector<HTMLInputElement>('[cmdk-input]')
                  ?.focus()
              }}
              className="rounded-full border px-3 py-1 font-mono text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {symbol}
            </button>
          </li>
        ))}
      </ul>
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

function SearchingRow({
  query,
  className,
}: {
  query: string
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      <span className="truncate">{copy.searching(query.trim())}</span>
    </div>
  )
}

interface GeneSearchInputProps {
  query: string
  setQuery: (query: string) => void
  /** Sets the query and searches immediately, skipping the typing debounce. */
  searchNow: (query: string) => void
  inputRef?: React.Ref<HTMLInputElement>
  /** Show the ⌘K hint (inline search; the dialog is already open). */
  shortcutHint?: boolean
  hasSearched: boolean
  searchResults: GeneSearchResult[]
  /** More genes matched than the palette shows. */
  truncated: boolean
  /** "Did you mean" symbols for an empty search. */
  suggestions: SimilarGene[]
  /** Open the full results page for the current query. */
  onSeeAll: () => void
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
          className="h-3.5 w-3.5 text-muted-foreground"
        />
      )}
      <span className="font-mono font-medium">
        <HighlightMatch text={gene.symbol} query={query} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <TruncatedText
          tooltip={gene.name}
          className="truncate text-muted-foreground"
        >
          <HighlightMatch text={gene.name} query={query} />
        </TruncatedText>
        {gene.matchedIsoformId && (
          <span className="font-mono text-xs text-muted-foreground">
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
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : isError ? (
        <CircleAlert className="h-4 w-4 text-destructive" />
      ) : (
        <WandSparkles className="h-4 w-4 text-muted-foreground" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TruncatedText tooltip={entry.name} className="truncate font-medium">
          <HighlightMatch text={entry.name} query={query} />
        </TruncatedText>
        <span className="truncate text-xs text-muted-foreground">
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
  searchNow,
  inputRef,
  shortcutHint = false,
  hasSearched,
  searchResults,
  truncated,
  suggestions,
  onSeeAll,
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
  const { species, handleSpeciesChange } = useSpeciesContext()
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

  const inSpecies = (g: SavedGene) =>
    species === 'both' || g.species === species

  const displayedFavorites = favoriteGenes
    .filter((g) => inSpecies(g) && geneMatches(g, trimmedQuery))
    .slice(0, perGroupLimit)

  const favIds = new Set(displayedFavorites.map((g) => g.id))
  const displayedRecents = recentGenes
    .filter(
      (g) => inSpecies(g) && !favIds.has(g.id) && geneMatches(g, trimmedQuery),
    )
    .slice(0, perGroupLimit)

  const displayedJobs = jobs
    .filter((j) => jobMatches(j, trimmedQuery))
    .slice(0, perGroupLimit)

  const seenIds = new Set([...favIds, ...displayedRecents.map((g) => g.id)])
  const displayedGeneResults = searchResults.filter((g) => !seenIds.has(g.id))

  const hasFavoriteGenes = displayedFavorites.length > 0
  const hasRecentGenes = displayedRecents.length > 0
  const hasJobs = displayedJobs.length > 0
  const hasGeneResults = displayedGeneResults.length > 0
  const hasAnySuggestions = hasFavoriteGenes || hasRecentGenes || hasJobs
  const hasResults = hasAnySuggestions || hasGeneResults

  // Single-source state resolution. Anything already worth showing (matching
  // favorites/recents/jobs, or the previous query's results that
  // `keepPreviousData` holds while the next one loads) stays on screen. With
  // nothing to show, a query always gets an explicit state: searching, then
  // results, no matches, or an error. The example genes only appear for an
  // empty query; they used to linger while a query was pending, so picking
  // one looked like nothing had happened.
  //
  // A gene-search error only hides the whole panel when there's nothing
  // else to show. If the user has matching favorites/recents/jobs, we still
  // render those and surface the gene error inline.
  const content: 'error' | 'results' | 'no-results' | 'searching' | 'prompt' =
    hasResults
      ? 'results'
      : !hasQuery
        ? 'prompt'
        : isLoading
          ? 'searching'
          : error
            ? 'error'
            : hasSearched
              ? 'no-results'
              : 'searching'

  // Defer dimming the result list ~180ms so fast queries never flicker.
  const showLoader = useDelayedTrue(isLoading, 180)

  const isNavigating = Boolean(pendingGene)

  return (
    <Command className="border md:min-w-[450px]" shouldFilter={false}>
      <CommandInput
        ref={inputRef}
        aria-label={copy.inputAria}
        aria-keyshortcuts={shortcutHint ? SEARCH_SHORTCUT_ARIA : undefined}
        endAddon={shortcutHint ? <SearchShortcutHint /> : undefined}
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
          <p className="text-sm text-muted-foreground">
            {copy.opening(pendingGene.symbol)}
          </p>
        </div>
      ) : (
        <SpeciesToggle />
      )}
      {/* cmdk's input always sets aria-controls to the list's id, and its own
          attributes win over props, so keep an empty, hidden list mounted
          whenever the real one isn't. Hidden, it isn't an empty listbox to
          assistive tech, but the reference resolves (axe
          aria-valid-attr-value, which failed Lighthouse CI). */}
      {(isNavigating || !showList || content !== 'results') && (
        <CommandList hidden />
      )}
      {!isNavigating && showList && (
        <>
          {content === 'error' && (
            <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-destructive-foreground">
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
            <ExampleGenes
              onPick={(symbol) => {
                searchNow(symbol)
                setShowList(true)
              }}
            />
          )}
          {content === 'searching' && <SearchingRow query={query} />}
          {content === 'no-results' && (
            <SearchEmptyState
              className="items-center px-4 py-6 text-center"
              query={query.trim()}
              speciesLabel={
                species === 'both' ? undefined : SPECIES_DISPLAY_NAME[species]
              }
              allSpeciesAction={
                species === 'both' ? undefined : (
                  <button
                    type="button"
                    onClick={() => handleSpeciesChange('both')}
                    className="rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {geneSearchCopy.results.searchAllSpecies}
                  </button>
                )
              }
              suggestions={suggestions}
              onNavigate={() => {
                setIsOpen(false)
                setShowList(false)
              }}
            />
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
                        <StarIcon className="h-4 w-4 text-muted-foreground" />
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
                          <ClockIcon className="h-4 w-4 text-muted-foreground" />
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
                          className="h-3.5 w-3.5 text-muted-foreground"
                        />
                        <span className="font-mono font-medium">
                          <HighlightMatch text={gene.symbol} query={query} />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <TruncatedText
                            tooltip={gene.name}
                            className="truncate text-muted-foreground"
                          >
                            <HighlightMatch text={gene.name} query={query} />
                          </TruncatedText>
                          {gene.matchedIsoformId && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {gene.matchedIsoformId}
                            </span>
                          )}
                        </div>
                        {gene.matchedIsoformId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-7 px-2"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            nativeButton={false}
                            render={
                              <Link
                                to="/design-tool"
                                search={{ isoform: gene.matchedIsoformId }}
                                aria-label={copy.customizeAria(
                                  gene.matchedIsoformId,
                                )}
                                onClick={() => {
                                  setIsOpen(false)
                                  setShowList(false)
                                }}
                              />
                            }
                          >
                            {copy.customize}
                            <ExternalLink className="size-3.5" />
                          </Button>
                        )}
                      </CommandItem>
                    ))}
                    {truncated && (
                      <CommandItem value="see-all" onSelect={onSeeAll}>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {copy.seeAll(query.trim())}
                        </span>
                      </CommandItem>
                    )}
                  </CommandGroup>
                </>
              )}
              {error && !hasGeneResults && hasQuery && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-destructive-foreground">
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
          {/* Saved genes or jobs can match before the gene search returns;
              say the search is still running rather than implying those are
              all the results. Outside the listbox, which may only hold
              options and groups. */}
          {content === 'results' && isLoading && !hasGeneResults && (
            <SearchingRow query={query} className="border-t" />
          )}
        </>
      )}
    </Command>
  )
}
