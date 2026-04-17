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
import { ClockIcon, ExternalLink, RefreshCwIcon, StarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DnaLoader } from '@/components/bio/dna-loader'
import type { SavedGene } from '@/features/gene-search/types/domain-types'
import { useSpeciesContext } from '@/stores/species-store'
import type { SpeciesFilter } from '@/lib/bio/species'
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
  useEffect(() => {
    if (!flag) {
      setDelayed(false)
      return
    }
    const t = setTimeout(() => setDelayed(true), delayMs)
    return () => clearTimeout(t)
  }, [flag, delayMs])
  return delayed
}

/** Small inline loader that fades in on the right edge of the input. */
function InputLoader({ visible }: { visible: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={visible ? copy.searching : ''}
      className={cn(
        'pointer-events-none absolute top-0 right-3 flex h-9 items-center transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <DnaLoader className="h-4 w-10" />
    </div>
  )
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
}: GeneSearchInputProps) {
  const [showList, setShowList] = useState(true)
  const { species } = useSpeciesContext()

  const internalHandleSelect = (gene: SavedGene) => {
    setShowList(false)
    handleSelect(gene)
  }

  const filteredRecents = useMemo(
    () =>
      species === 'both'
        ? recentGenes
        : recentGenes.filter((g) => g.species === species),
    [recentGenes, species],
  )
  const filteredFavorites = useMemo(
    () =>
      species === 'both'
        ? favoriteGenes
        : favoriteGenes.filter((g) => g.species === species),
    [favoriteGenes, species],
  )

  const hasRecentGenes = filteredRecents.length > 0
  const hasFavoriteGenes = filteredFavorites.length > 0
  const hasAnySuggestions = hasRecentGenes || hasFavoriteGenes
  const hasResults = searchResults.length > 0

  // Single-source state resolution. The key insight: while the user is
  // typing and waiting for the first query to settle, we keep showing
  // whatever was visible before (suggestions or prior results) rather
  // than blanking the body. With `keepPreviousData` in the hook,
  // `searchResults` stays populated across keystrokes, and `hasSearched`
  // only flips to true once a query has resolved at least once.
  const content: 'error' | 'results' | 'no-results' | 'suggestions' | 'prompt' =
    error
      ? 'error'
      : hasResults
        ? 'results'
        : hasSearched && !isLoading
          ? 'no-results'
          : hasAnySuggestions
            ? 'suggestions'
            : 'prompt'

  // Defer the inline loader ~180ms. Most searches resolve inside that
  // window and never reveal it, which is how Google and Raycast feel
  // instant even though they're actually async.
  const showLoader = useDelayedTrue(isLoading, 180)

  return (
    <Command
      className="rounded-lg border md:min-w-[450px]"
      shouldFilter={false}
    >
      <div className="relative">
        <CommandInput
          id="search"
          aria-label={copy.inputAria}
          placeholder={copy.placeholder}
          className="border-0 text-base ring-0 outline-0 focus:border-0 focus:ring-0 active:border-0 active:ring-0 sm:text-sm"
          value={query}
          onValueChange={(q) => {
            setQuery(q)
            if (!showList) {
              setShowList(true)
            }
          }}
          autoFocus
        />
        <InputLoader visible={showLoader} />
      </div>
      <SpeciesToggle />
      {showList && (
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
          {(content === 'suggestions' || content === 'results') && (
            <CommandList
              className={cn(
                'max-h-[300px] overflow-y-auto transition-opacity duration-200',
                // Dim the list while a fresh query is loading to telegraph
                // that newer results are on the way, without yanking the
                // current content out from under the user.
                showLoader && 'opacity-60',
              )}
            >
              {content === 'suggestions' && (
                <>
                  {hasFavoriteGenes && (
                    <CommandGroup heading={copy.favorites}>
                      {filteredFavorites.slice(0, 3).map((gene) => (
                        <CommandItem
                          key={`fav-${gene.id}`}
                          value={`fav-${gene.id}`}
                          onSelect={() => internalHandleSelect(gene)}
                        >
                          <StarIcon className="text-muted-foreground h-4 w-4" />
                          {gene.species && (
                            <SpeciesIcon
                              species={gene.species}
                              className="text-muted-foreground h-3.5 w-3.5"
                            />
                          )}
                          <span className="font-mono font-medium">
                            {gene.symbol}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <TruncatedText
                              tooltip={gene.name}
                              className="text-muted-foreground truncate"
                            >
                              {gene.name}
                            </TruncatedText>
                            {gene.matchedIsoformId && (
                              <span className="text-muted-foreground font-mono text-xs">
                                {gene.matchedIsoformId}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {hasRecentGenes && (
                    <>
                      {hasFavoriteGenes && <CommandSeparator />}
                      <CommandGroup heading={copy.recentGenes}>
                        {filteredRecents.slice(0, 3).map((gene) => (
                          <CommandItem
                            key={`recent-${gene.id}`}
                            value={`recent-${gene.id}`}
                            onSelect={() => internalHandleSelect(gene)}
                          >
                            <ClockIcon className="text-muted-foreground h-4 w-4" />
                            {gene.species && (
                              <SpeciesIcon
                                species={gene.species}
                                className="text-muted-foreground h-3.5 w-3.5"
                              />
                            )}
                            <span className="font-mono font-medium">
                              {gene.symbol}
                            </span>
                            <div className="flex min-w-0 flex-col">
                              <TruncatedText
                                tooltip={gene.name}
                                className="text-muted-foreground truncate"
                              >
                                {gene.name}
                              </TruncatedText>
                              {gene.matchedIsoformId && (
                                <span className="text-muted-foreground font-mono text-xs">
                                  {gene.matchedIsoformId}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </>
              )}
              {content === 'results' &&
                searchResults.map((gene) => (
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
                    <div className="flex min-w-0 flex-col">
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
                          aria-label={copy.customizeAria(gene.matchedIsoformId)}
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
            </CommandList>
          )}
        </>
      )}
    </Command>
  )
}
