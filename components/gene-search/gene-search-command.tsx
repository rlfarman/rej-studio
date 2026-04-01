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
import { Badge } from '@/components/ui/badge'
import type { GeneSearchResult } from '@/actions/genes'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { SpeciesIcon } from '@/components/species-icon'
import { HighlightMatch } from '@/lib/highlight-match'
import { useState } from 'react'
import { ClockIcon, HeartIcon } from 'lucide-react'
import type { SavedGene } from '@/lib/domain-types'

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
            <div className="text-destructive-foreground p-4 text-center text-sm">
              {error}
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
                        onSelect={() =>
                          internalHandleSelect(gene)
                        }
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
                        <span className="text-muted-foreground truncate">
                          {gene.name}
                        </span>
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
                          onSelect={() =>
                            internalHandleSelect(gene)
                          }
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
                          <span className="text-muted-foreground truncate">
                            {gene.name}
                          </span>
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
                  <div className="grid grid-cols-[96px_1fr] items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="grid w-[96px] grid-cols-[24px_1fr] items-center gap-2 truncate overflow-hidden font-mono">
                          <SpeciesIcon
                            species={gene.species}
                            className="text-secondary h-4 w-4"
                          />
                          <span className="truncate">
                            <HighlightMatch
                              text={gene.symbol}
                              query={query}
                            />
                          </span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{gene.symbol}</TooltipContent>
                    </Tooltip>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm">
                        <HighlightMatch text={gene.name} query={query} />
                      </p>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </>
          )}
        </CommandList>
      )}
    </Command>
  )
}
