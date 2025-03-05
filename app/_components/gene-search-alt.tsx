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

interface GeneSearchProperties {
  defaultQuery?: string
  hideByDefault?: boolean
  searchGenes: (
    content: string
  ) => Promise<Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>>>
}

export function GeneSearch({
  searchGenes,
  defaultQuery,
  hideByDefault = false,
}: GeneSearchProperties) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchResults, setSearchResults] = useState<
    Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>>
  >([])
  const [debouncedQuery] = useDebounce(query, 200)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let current = true
    if (debouncedQuery.trim().length > 0) {
      searchGenes(debouncedQuery).then((results) => {
        if (current) {
          setSearchResults(results)
          setHasSearched(true)
        }
      })
    }
    return () => {
      current = false
    }
  }, [debouncedQuery, searchGenes])

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

  const handleSelect = (
    gene: Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>
  ) => {
    setIsOpen(false)
    router.push(`/genes/${gene.symbol}`)
  }

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
      <CommandDialog open={isOpen}>
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
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            autoFocus={!hideByDefault}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
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
                className="grid grid-cols-[96px_1fr] items-center gap-3 py-3"
                onSelect={() => handleSelect(gene)}
              >
                <Badge className="w-[96px] truncate font-mono">
                  {gene.symbol}
                </Badge>
                <div className="space-y-1">
                  <p className="truncate text-sm text-gray-800">{gene.name}</p>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
