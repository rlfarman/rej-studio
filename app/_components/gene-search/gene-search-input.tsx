import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { GeneSearchSkeleton } from './gene-search-skeleton'
import type { GeneSearchResult } from '@/actions'

interface GeneSearchInputProps {
  query: string
  setQuery: (query: string) => void
  hasSearched: boolean
  searchResults: Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>>
  isLoading: boolean
  handleSelect: (gene: Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>) => void
  inputRef?: React.RefObject<HTMLInputElement>
  hideByDefault?: boolean
}

export function GeneSearchInput({
  query,
  setQuery,
  hasSearched,
  searchResults,
  isLoading,
  handleSelect,
  inputRef,
  hideByDefault,
}: GeneSearchInputProps) {
  return (
    <Command
      className="rounded-lg border md:min-w-[450px]"
      shouldFilter={false}
    >
      <CommandInput
        id="search"
        ref={inputRef}
        placeholder="Search for Genes"
        className="border-0 text-base outline-0 ring-0 focus:border-0 focus:ring-0 active:border-0 active:ring-0 sm:text-sm"
        value={query}
        onValueChange={(q) => setQuery(q)}
        autoFocus={!hideByDefault}
      />
      <CommandList className="max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <GeneSearchSkeleton />
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
                <Badge className="w-[72px] truncate font-mono">
                  {gene.symbol}
                </Badge>
                <div className="space-y-1">
                  <p className="truncate text-sm text-gray-800">{gene.name}</p>
                </div>
              </CommandItem>
            ))}
          </>
        )}
      </CommandList>
    </Command>
  )
}
