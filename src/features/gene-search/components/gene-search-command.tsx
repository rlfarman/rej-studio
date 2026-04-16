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
import { useMemo, useState } from 'react'
import {
  ClockIcon,
  ExternalLink,
  Loader2,
  RefreshCwIcon,
  StarIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SavedGene } from '@/features/gene-search/types/domain-types'
import { useSpeciesContext } from '@/stores/species-store'
import type { SpeciesFilter } from '@/lib/bio/species'
import { geneSearchCopy } from '@/features/gene-search/copy'

const SPECIES_OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'both', label: geneSearchCopy.search.species.all },
  { value: 'human', label: geneSearchCopy.search.species.human },
  { value: 'mouse', label: geneSearchCopy.search.species.mouse },
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

function GeneResultsLoading() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 p-4 text-sm">
      <Loader2 className="size-4 animate-spin" />
      {geneSearchCopy.search.loading}
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

  const showEmptyState = query.trim() === '' && !hasSearched
  const hasRecentGenes = filteredRecents.length > 0
  const hasFavoriteGenes = filteredFavorites.length > 0
  const hasAnySuggestions = hasRecentGenes || hasFavoriteGenes

  return (
    <Command
      className="rounded-lg border md:min-w-[450px]"
      shouldFilter={false}
    >
      <CommandInput
        id="search"
        aria-label={geneSearchCopy.search.inputAriaLabel}
        placeholder={geneSearchCopy.search.inputPlaceholder}
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
      <SpeciesToggle />
      {showList && (
        <>
          {/* Non-listbox states: render outside CommandList to avoid
              aria-required-children violations (listbox must only contain
              option-role children). */}
          {isLoading ? (
            <GeneResultsLoading />
          ) : error ? (
            <div className="text-destructive-foreground flex flex-col items-center gap-2 p-4 text-center text-sm">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={retry}
              >
                <RefreshCwIcon className="size-3" />
                {geneSearchCopy.search.retry}
              </Button>
            </div>
          ) : showEmptyState && !hasAnySuggestions ? (
            <div className="py-6 text-center text-sm">
              {geneSearchCopy.search.emptyPrompt}
            </div>
          ) : hasSearched && searchResults.length === 0 ? (
            <div className="py-6 text-center text-sm">
              {geneSearchCopy.search.noMatches(query)}{' '}
              <Link
                href="/design-tool"
                className="text-primary font-medium underline underline-offset-4"
                onClick={() => {
                  setIsOpen(false)
                  setShowList(false)
                }}
              >
                {geneSearchCopy.search.customSequenceLink}
              </Link>
            </div>
          ) : null}

          {/* CommandList (role="listbox") only when there are CommandItem children. */}
          {!isLoading && !error && (
            <CommandList className="max-h-[300px] overflow-y-auto">
              {showEmptyState && hasAnySuggestions && (
                <>
                  {hasFavoriteGenes && (
                    <CommandGroup
                      heading={geneSearchCopy.search.groups.favorites}
                    >
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
                      <CommandGroup
                        heading={geneSearchCopy.search.groups.recent}
                      >
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
              {searchResults.map((gene) => (
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
                        aria-label={geneSearchCopy.search.customizeAriaLabel(
                          gene.matchedIsoformId,
                        )}
                        onClick={() => {
                          setIsOpen(false)
                          setShowList(false)
                        }}
                      >
                        {geneSearchCopy.search.customizeAction}
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
