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
  searchResults: Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>>
  isLoading: boolean
  handleSelect: (gene: Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>) => void
}

export function GeneSearchCommand({
  query,
  setQuery,
  hasSearched,
  searchResults,
  isLoading,
  handleSelect,
}: GeneSearchInputProps) {
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
                    className="text-sky-600 hover:underline dark:text-sky-500"
                  >
                    Try entering a custom genetic sequence instead.
                  </Link>
                </div>
              )}
            </CommandEmpty>
            {searchResults.map((gene) => (
              <CommandItem
                key={gene.id}
                value={gene.name}
                className="grid grid-cols-[72px_1fr] items-center gap-3 py-3"
                onSelect={() => handleSelect(gene)}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="block w-[72px] truncate text-center font-mono">
                      {gene.symbol}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center text-xs">{gene.symbol}</div>
                  </TooltipContent>
                </Tooltip>
                <div className="space-y-1">
                  <p className="text-sm">{gene.name}</p>
                </div>
              </CommandItem>
            ))}
          </>
        )}
      </CommandList>
    </Command>
  )
}
