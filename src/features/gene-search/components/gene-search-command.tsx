import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/ui/autocomplete'
import { Link, useRouter } from '@tanstack/react-router'
import type { GeneSearchResult } from '@/features/gene-search/types/search'
import type { SimilarGene } from '@/features/gene-search/types/search'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { TruncatedText } from '@/components/truncated-text'
import { HighlightMatch } from '@/features/gene-search/utils/highlight-match'
import { useEffect, useRef, useState } from 'react'
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
import { useSearchShortcut } from '@/hooks/use-search-shortcut'
import { geneSearchCopy } from '../copy'
import { geneLink } from '../utils/search-href'
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
 * for it right away (so the results show how search works); the caller
 * returns focus to the input so arrow keys reach the results.
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
              onClick={() => onPick(symbol)}
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

/** One option in the palette's listbox; Enter or a click runs it. */
type PaletteItem =
  | { kind: 'favorite' | 'recent' | 'result'; key: string; gene: SavedGene }
  | { kind: 'job'; key: string; entry: JobSearchItem }
  | { kind: 'see-all'; key: string }

interface PaletteGroup {
  key: string
  label: string
  items: PaletteItem[]
}

// The text Base UI would put in the input when an option is picked. The
// palette ignores those changes (see onValueChange), so this only names the
// option for Base UI's own bookkeeping.
function paletteItemToString(item: PaletteItem): string {
  switch (item.kind) {
    case 'job':
      return item.entry.name
    case 'see-all':
      return item.key
    default:
      return item.gene.symbol
  }
}

interface GeneSearchInputProps {
  query: string
  setQuery: (query: string) => void
  /** Sets the query and searches immediately, skipping the typing debounce. */
  searchNow: (query: string) => void
  /**
   * On a page rather than in the dialog: show the ⌘K hint, focus this input
   * on ⌘K and on mount. The dialog's ⌘K belongs to GeneSearchTrigger.
   */
  onPage?: boolean
  hasSearched: boolean
  searchResults: GeneSearchResult[]
  /** More genes matched than the palette shows. */
  truncated: boolean
  /** "Did you mean" symbols for an empty search. */
  suggestions: SimilarGene[]
  /** Open the full results page for the current query. */
  onSeeAll: () => void
  isLoading: boolean
  setIsOpen: (open: boolean) => void
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

function GeneRowBody({ gene, query }: { gene: SavedGene; query: string }) {
  return (
    <>
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
    </>
  )
}

function JobRowBody({ entry, query }: { entry: JobSearchItem; query: string }) {
  const isRunning = entry.status === 'running'
  const isError = entry.status === 'failed' || entry.status === 'cancelled'
  return (
    <>
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
    </>
  )
}

/**
 * The gene search palette: Base UI's Autocomplete rendered inline (always
 * open, no popup of its own), on the home page or inside the header's
 * Dialog. Results are filtered by the search worker, not by Base UI
 * (`filter={null}`); each option runs an action instead of filling the
 * input.
 */
export function GeneSearchCommand({
  query,
  setQuery,
  searchNow,
  onPage = false,
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
  const inputRef = useRef<HTMLInputElement>(null)

  useSearchShortcut(() => {
    if (!onPage) return
    inputRef.current?.focus()
    inputRef.current?.select()
  })

  // Highlighting a gene (arrow keys or hover) preloads its page, as hovering
  // a link does elsewhere (the router's `defaultPreload: 'intent'`): palette
  // rows open with navigate(), so the router never sees an intent. After the
  // same short pause the router uses, so arrowing past a row costs nothing.
  const router = useRouter()
  const preloadTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const preloadHighlighted = (item: PaletteItem | undefined) => {
    clearTimeout(preloadTimer.current)
    if (!item || !('gene' in item)) return
    const { gene } = item
    preloadTimer.current = setTimeout(() => {
      void router
        .preloadRoute(
          geneLink(gene.symbol, gene.species, gene.matchedIsoformId),
        )
        .catch(() => {
          // A failed preload is the click's to report, if it fails too.
        })
    }, 50)
  }
  useEffect(() => () => clearTimeout(preloadTimer.current), [])

  const runItem = (item: PaletteItem) => {
    if (item.kind === 'see-all') {
      onSeeAll()
      return
    }
    setShowList(false)
    if (item.kind === 'job') handleSelectJob(item.entry)
    else handleSelect(item.gene)
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

  const hasGeneResults = displayedGeneResults.length > 0

  // The listbox's contents, in order. Base UI walks these for arrow keys and
  // highlighting, so they're built here once rather than as loose children.
  const groups: PaletteGroup[] = [
    {
      key: 'favorites',
      label: copy.favorites,
      items: displayedFavorites.map((gene) => ({
        kind: 'favorite' as const,
        key: `fav-${gene.id}`,
        gene,
      })),
    },
    {
      key: 'recent',
      label: copy.recentGenes,
      items: displayedRecents.map((gene) => ({
        kind: 'recent' as const,
        key: `recent-${gene.id}`,
        gene,
      })),
    },
    {
      key: 'jobs',
      label: copy.recentJobs,
      items: displayedJobs.map((entry) => ({
        kind: 'job' as const,
        key: `job-${entry.id}`,
        entry,
      })),
    },
    {
      key: 'genes',
      label: copy.genes,
      items: hasGeneResults
        ? [
            ...displayedGeneResults.map((gene) => ({
              kind: 'result' as const,
              key: gene.id,
              gene,
            })),
            ...(truncated
              ? [{ kind: 'see-all' as const, key: 'see-all' }]
              : []),
          ]
        : [],
    },
  ].filter((group) => group.items.length > 0)

  const hasResults = groups.length > 0

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

  const renderItem = (item: PaletteItem) => (
    <AutocompleteItem key={item.key} value={item} onClick={() => runItem(item)}>
      {item.kind === 'job' ? (
        <JobRowBody entry={item.entry} query={query} />
      ) : item.kind === 'see-all' ? (
        <>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {copy.seeAll(query.trim())}
          </span>
        </>
      ) : (
        <>
          {item.kind === 'favorite' && (
            <StarIcon className="h-4 w-4 text-muted-foreground" />
          )}
          {item.kind === 'recent' && (
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          )}
          {item.gene.species && (
            <SpeciesIcon
              species={item.gene.species}
              className="h-3.5 w-3.5 text-muted-foreground"
            />
          )}
          <GeneRowBody gene={item.gene} query={query} />
          {item.kind === 'result' && item.gene.matchedIsoformId && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2"
              nativeButton={false}
              render={
                <Link
                  to="/design-tool"
                  search={{ isoform: item.gene.matchedIsoformId }}
                  aria-label={copy.customizeAria(item.gene.matchedIsoformId)}
                  onClick={(e) => {
                    // The link, not the option it sits in, handles the click.
                    e.stopPropagation()
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
        </>
      )}
    </AutocompleteItem>
  )

  return (
    <div className="flex size-full flex-col overflow-hidden rounded-3xl border bg-popover p-1 text-popover-foreground md:min-w-[450px]">
      <Autocomplete
        // Inline: the list is part of this panel, not a popup, so it's
        // always open (https://base-ui.com/react/components/autocomplete).
        inline
        open
        items={groups}
        // The search worker already filtered and ranked the results.
        filter={null}
        itemToStringValue={paletteItemToString}
        // Like a command palette, Enter runs the first option without an
        // arrow key first, and the highlight stays when the pointer leaves.
        autoHighlight="always"
        keepHighlight
        onItemHighlighted={preloadHighlighted}
        value={isNavigating && pendingGene ? pendingGene.symbol : query}
        onValueChange={(q, details) => {
          // Only typing changes the query. Base UI also writes a picked
          // option's text into the input and clears it on Escape; the
          // palette runs the option instead, and keeps the query when the
          // dialog closes.
          if (details.reason !== 'input-change') return
          setQuery(q)
          if (!showList) setShowList(true)
        }}
      >
        <AutocompleteInput
          ref={inputRef}
          aria-label={copy.inputAria}
          aria-keyshortcuts={onPage ? SEARCH_SHORTCUT_ARIA : undefined}
          endAddon={onPage ? <SearchShortcutHint /> : undefined}
          placeholder={isMobile ? copy.placeholderMobile : copy.placeholder}
          className="border-0 text-base ring-0 outline-0 focus:border-0 focus:ring-0 active:border-0 active:ring-0 sm:text-sm"
          disabled={isNavigating}
          // Inline only. The dialog focuses its first field itself, and an
          // input that grabs focus while the dialog mounts leaves the dialog
          // nothing to hand focus back to when it closes.
          autoFocus={onPage}
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
                  // Back to the input, so arrow keys reach the results.
                  inputRef.current?.focus()
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

            {/* The listbox only when it has options; without it the input
                drops aria-controls rather than pointing at an empty list. */}
            {content === 'results' && (
              <AutocompleteList
                className={cn(
                  'max-h-[300px] transition-opacity duration-200',
                  // Dim the list while a fresh query is loading to telegraph
                  // that newer results are on the way, without yanking the
                  // current content out from under the user.
                  showLoader && 'opacity-60',
                )}
              >
                {(group: PaletteGroup) => (
                  <AutocompleteGroup key={group.key} items={group.items}>
                    <AutocompleteGroupLabel>
                      {group.label}
                    </AutocompleteGroupLabel>
                    <AutocompleteCollection>
                      {renderItem}
                    </AutocompleteCollection>
                  </AutocompleteGroup>
                )}
              </AutocompleteList>
            )}
            {/* Outside the listbox, which may only hold options and groups. */}
            {content === 'results' && error && !hasGeneResults && hasQuery && (
              <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-destructive-foreground">
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
            {/* Saved genes or jobs can match before the gene search returns;
                say the search is still running rather than implying those are
                all the results. */}
            {content === 'results' && isLoading && !hasGeneResults && (
              <SearchingRow query={query} className="border-t" />
            )}
          </>
        )}
      </Autocomplete>
    </div>
  )
}
