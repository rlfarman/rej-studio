import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { GeneSearchResult } from '@/actions'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { SpeciesIcon } from '@/components/species-icon' // Import the SpeciesIcon component

export function GeneResultsSkeleton() {
  return (
    <div>
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[72px_1fr] items-center gap-3 px-2 py-3"
        >
          <Skeleton className="h-6 w-[72px]" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  )
}
interface GeneSearchInputProps {
  query: string
  setQuery: (query: string) => void
  hasSearched: boolean
  searchResults: Array<
    Pick<GeneSearchResult, 'symbol' | 'id' | 'name' | 'species'>
  >
  isLoading: boolean
  setIsOpen: (isLoading: boolean) => void
  handleSelect: (
    gene: Pick<GeneSearchResult, 'symbol' | 'id' | 'name' | 'species'>
  ) => void
}

export function GeneSearchCommand({
  query,
  setQuery,
  hasSearched,
  searchResults,
  isLoading,
  setIsOpen,
  handleSelect,
}: GeneSearchInputProps) {
  console.log('GeneSearchCommand', {
    query,
    hasSearched,
    searchResults,
    isLoading,
  })
  return (
    <Command
      className="rounded-lg border md:min-w-[450px]"
      shouldFilter={false}
    >
      <CommandInput
        id="search"
        placeholder="Search for Genes"
        className="border-0 text-base outline-0 ring-0 focus:border-0 focus:ring-0 active:border-0 active:ring-0 sm:text-sm"
        value={query}
        onValueChange={(q) => setQuery(q)}
        autoFocus
      />
      <CommandList className="max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <GeneResultsSkeleton />
        ) : (
          <>
            <CommandEmpty>
              {query.trim() === '' || !hasSearched ? (
                'Start typing to search for genes.'
              ) : (
                <div>
                  No results found.{' '}
                  <Link
                    href="/design-tool"
                    className="text-primary font-medium underline underline-offset-4"
                    onClick={() => setIsOpen(false)}
                  >
                    Try entering a custom genetic sequence instead.
                  </Link>
                </div>
              )}
            </CommandEmpty>
            {searchResults.map((gene) => (
              <CommandItem
                key={gene.id}
                value={gene.id}
                onSelect={() => handleSelect(gene)}
              >
                <div
                  className="grid items-center"
                  style={{ gridTemplateColumns: '96px 1fr' }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        className="grid w-[96px] items-center gap-2 overflow-hidden truncate font-mono"
                        style={{ gridTemplateColumns: '24px 1fr' }}
                      >
                        <SpeciesIcon
                          species={gene.species} // Pass the species prop
                          className="text-secondary h-4 w-4"
                        />
                        <span className="truncate">{gene.symbol}</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center text-xs">{gene.symbol}</div>
                    </TooltipContent>
                  </Tooltip>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm">{gene.name}</p>
                  </div>
                </div>
              </CommandItem>
            ))}
          </>
        )}
      </CommandList>
    </Command>
  )
}
