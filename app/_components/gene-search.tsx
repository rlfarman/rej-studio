'use client'
import { useEffect, useState, useRef } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useDebounce } from 'use-debounce'
import { useRouter } from 'next/navigation'
import type { GeneSearchResult } from '@/actions'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from './ui/button'
import { SearchIcon } from 'lucide-react'
import { useGeneSearch } from '@/hooks/useGeneSearch'
import { Skeleton } from './ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export function GeneSearchSkeleton() {
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
interface GeneSearchProperties {
  searchGenes: (
    content: string
  ) => Promise<Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>>>
  defaultQuery?: string
  isDialog?: boolean
}

export function GeneSearch({
  searchGenes,
  defaultQuery,
  isDialog = false,
}: GeneSearchProperties) {
  const router = useRouter()
  const { query, setQuery, hasSearched, searchResults, isLoading } =
    useGeneSearch({
      searchGenes,
      defaultQuery,
    })
  const [debouncedQuery] = useDebounce(query, 500)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let current = true
    if (debouncedQuery.trim().length > 0) {
      searchGenes(debouncedQuery).then((results) => {
        if (current) {
        }
      })
    }
    return () => {
      current = false
    }
  }, [debouncedQuery, searchGenes])

  const handleSelect = (
    gene: Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>
  ) => {
    setIsOpen(false)
    router.push(`/genes/${gene.symbol}`)
    setQuery(gene.symbol)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen((isOpen) => !isOpen)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const renderSearchInput = () => (
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
        autoFocus
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
                  <p className="text-sm text-gray-800">{gene.name}</p>
                </div>
              </CommandItem>
            ))}
          </>
        )}
      </CommandList>
    </Command>
  )

  if (isDialog) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="text-muted-foreground hover:text-muted-foreground min-w-42 sm:min-w-96 md:min-w-112 w-full cursor-pointer justify-between"
        >
          <div className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5" />
            <span>Search for Genes</span>
          </div>
          <p className="text-muted-foreground hidden text-sm md:block">
            Press{' '}
            <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>J
            </kbd>
          </p>
        </Button>
        <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
          {renderSearchInput()}
        </CommandDialog>
      </>
    )
  }

  return (
    <div className="absolute left-1/2 -translate-x-1/2 transform">
      {renderSearchInput()}
    </div>
  )
}
