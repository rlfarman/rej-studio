'use client'
import { useEffect, useState, useRef } from 'react'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { genes as SelectGene } from '@/drizzle/schema'
import { useDebounce } from 'use-debounce'
import { useRouter } from 'next/navigation'
import type { GeneSearchResult } from '@/actions'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import Link from 'next/link'

interface GeneSearchProperties {
  defaultQuery?: string
  hideByDefault?: boolean
  searchGenes: (
    content: string
  ) => Promise<Array<Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>>>
}

export default function GeneSearch({
  searchGenes,
  defaultQuery,
  hideByDefault = false,
}: GeneSearchProperties) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchResults, setSearchResults] = useState<
    Array<
      Pick<typeof SelectGene, 'symbol' | 'id' | 'name'> & {
        similarity?: number
      }
    >
  >([])
  const [debouncedQuery] = useDebounce(query, 200)
  const [isFocused, setIsFocused] = useState(false)
  const commandRef = useRef<HTMLDivElement>(null)
  const [commandWidth, setCommandWidth] = useState<number | undefined>(
    undefined
  )

  useEffect(() => {
    if (commandRef.current) {
      const updateWidth = () => {
        if (commandRef.current) {
          setCommandWidth(commandRef.current.getBoundingClientRect().width)
        }
      }

      updateWidth()
      window.addEventListener('resize', updateWidth)

      return () => {
        window.removeEventListener('resize', updateWidth)
      }
    }
  }, [])

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

  const handleSelect = (gene: GeneSearchResult) => {
    router.push(`/genes/${gene.symbol}`)
    setQuery(gene.symbol)
  }

  return (
    <Popover open={!hideByDefault || isFocused}>
      <div ref={commandRef}>
        <Command
          className="rounded-lg border shadow-md md:min-w-[450px]"
          shouldFilter={false}
        >
          <PopoverTrigger asChild>
            <CommandInput
              id="search"
              placeholder="Search for Genes"
              className="border-0 text-base outline-0 ring-0 focus:border-0 focus:ring-0 active:border-0 active:ring-0 sm:text-sm"
              value={query}
              onValueChange={(q) => setQuery(q)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
          </PopoverTrigger>
          <PopoverContent
            onOpenAutoFocus={(e) => e.preventDefault()}
            sideOffset={0}
            alignOffset={0}
            side="bottom"
            align="start"
            className="-translate-x-9 p-0"
            style={{
              width: commandWidth ? `${commandWidth}px` : 'auto',
            }}
          >
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
                  className="flex items-center justify-between py-3"
                  onSelect={() => handleSelect(gene)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="rounded bg-zinc-100 p-0.5 font-mono text-xs">
                      {gene.symbol}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-800">
                        {gene.name.substring(0, 90)}
                      </p>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </PopoverContent>
        </Command>
      </div>
    </Popover>
  )
}
