import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { GeneSearchResult } from '@/actions/genes'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { SpeciesIcon } from '@/components/species-icon'
import { useState } from 'react'

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
  searchResults: GeneSearchResult[]
  isLoading: boolean
  setIsOpen: (isLoading: boolean) => void
  handleSelect: (gene: GeneSearchResult) => void
  error: string | null
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
}: GeneSearchInputProps) {
  const [showList, setShowList] = useState(true)

  const internalHandleSelect = (gene: GeneSearchResult) => {
    setShowList(false)
    handleSelect(gene)
  }

  return (
    <Command
      className="rounded-lg border md:min-w-[450px]"
      shouldFilter={false}
    >
      <CommandInput
        id="search"
        placeholder="Search for Genes"
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
            <GeneResultsSkeleton />
          ) : error ? (
            <div className="text-destructive p-4 text-center text-sm">
              {error}
            </div>
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
                      onClick={() => {
                        setIsOpen(false)
                        setShowList(false)
                      }}
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
                  onSelect={() => internalHandleSelect(gene)}
                >
                  <div
                    className="grid items-center"
                    style={{ gridTemplateColumns: '96px 1fr' }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          className="grid w-[96px] items-center gap-2 truncate overflow-hidden font-mono"
                          style={{ gridTemplateColumns: '24px 1fr' }}
                        >
                          <SpeciesIcon
                            species={gene.species}
                            className="text-secondary h-4 w-4"
                          />
                          <span className="truncate">{gene.symbol}</span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{gene.symbol}</TooltipContent>
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
      )}
    </Command>
  )
}
