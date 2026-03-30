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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { SpeciesIcon } from '@/components/species-icon'
import { useState } from 'react'

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
            <GeneResultsLoading />
          ) : error ? (
            <div className="text-destructive-foreground p-4 text-center text-sm">
              {error}
            </div>
          ) : (
            <>
              <CommandEmpty>
                {query.trim() === '' || !hasSearched ? (
                  'Search by gene symbol or name.'
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
