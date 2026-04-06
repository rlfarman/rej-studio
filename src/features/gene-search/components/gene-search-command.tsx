import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import Link from 'next/link'
import type { GeneSearchResult } from '@/features/gene-search/api/genes'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { TruncatedText } from '@/components/truncated-text'
import { HighlightMatch } from '@/features/gene-search/utils/highlight-match'
import { useState } from 'react'
import { ClockIcon, ExternalLink, HeartIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SavedGene } from '@/features/gene-search/types/domain-types'

export function GeneResultsLoading() {
  return (
    <div className="text-muted-foreground p-4 text-center text-sm">
      Searching...
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

  const internalHandleSelect = (gene: SavedGene) => {
    setShowList(false)
    handleSelect(gene)
  }

  const showEmptyState = query.trim() === '' && !hasSearched
  const hasRecentGenes = recentGenes.length > 0
  const hasFavoriteGenes = favoriteGenes.length > 0
  const hasAnySuggestions = hasRecentGenes || hasFavoriteGenes

  return (
    <Command
      className="rounded-lg border md:min-w-[450px]"
      shouldFilter={false}
    >
      <CommandInput
        id="search"
        placeholder="Search by gene symbol, name, or disease..."
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
      {showList && (
        <CommandList className="max-h-[300px] overflow-y-auto">
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
                Retry
              </Button>
            </div>
          ) : showEmptyState ? (
            hasAnySuggestions ? (
              <>
                {hasFavoriteGenes && (
                  <CommandGroup heading="Favorites">
                    {favoriteGenes.slice(0, 5).map((gene) => (
                      <CommandItem
                        key={`fav-${gene.id}`}
                        value={`fav-${gene.id}`}
                        onSelect={() => internalHandleSelect(gene)}
                      >
                        <HeartIcon className="text-muted-foreground h-4 w-4" />
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
                    <CommandGroup heading="Recent Genes">
                      {recentGenes.slice(0, 5).map((gene) => (
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
            ) : (
              <CommandEmpty>
                Search by gene symbol, name, or disease.
              </CommandEmpty>
            )
          ) : (
            <>
              <CommandEmpty>
                {!hasSearched ? (
                  'Search by gene symbol, name, or disease.'
                ) : (
                  <div>
                    No genes match &ldquo;{query}&rdquo;.{' '}
                    <Link
                      href="/design-tool"
                      className="text-primary font-medium underline underline-offset-4"
                      onClick={() => {
                        setIsOpen(false)
                        setShowList(false)
                      }}
                    >
                      Enter a custom sequence instead.
                    </Link>
                  </div>
                )}
              </CommandEmpty>
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
                        aria-label={`Customize ${gene.matchedIsoformId}`}
                        onClick={() => {
                          setIsOpen(false)
                          setShowList(false)
                        }}
                      >
                        Customize
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </Button>
                  )}
                </CommandItem>
              ))}
            </>
          )}
        </CommandList>
      )}
    </Command>
  )
}
