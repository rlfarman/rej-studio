'use client'
import { useEffect, useState } from 'react'
import { CommandDialog } from '@/components/ui/command'
import { useRouter } from 'next/navigation'
import { type GeneSearchResult } from '@/actions/genes'
import { Button } from './ui/button'
import { SearchIcon } from 'lucide-react'
import { useGeneSearch } from '@/hooks/use-gene-search'
import { GeneSearchCommand } from './gene-search/gene-search-command'
import { useRecentGenes } from '@/context/recent-genes-context'
import type { SpeciesFilter } from '@/lib/species'

interface GeneSearchProperties {
  searchGenes: (
    content: string,
    species?: SpeciesFilter,
  ) => Promise<GeneSearchResult[]>
  defaultQuery?: string
  isDialog?: boolean
}

export function GeneSearch({
  searchGenes,
  defaultQuery,
  isDialog = false,
}: GeneSearchProperties) {
  const router = useRouter()
  const { query, setQuery, hasSearched, searchResults, isLoading, error } =
    useGeneSearch({
      searchGenes,
      defaultQuery,
    })
  const [isOpen, setIsOpen] = useState(false)
  const { addRecentGene } = useRecentGenes()

  const handleSelect = (gene: GeneSearchResult) => {
    setIsOpen(false)
    addRecentGene({
      id: gene.id,
      name: gene.name,
      symbol: gene.symbol,
    })
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

  if (isDialog) {
    return (
      <div>
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="text-muted-foreground hover:text-muted-foreground w-full min-w-42 cursor-pointer justify-between sm:min-w-96 md:min-w-72 xl:min-w-108"
        >
          <div className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5" />
            <span>Search for Genes</span>
          </div>
          <p className="text-muted-foreground hidden text-sm md:block">
            Press{' '}
            <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
              <span className="text-xs">⌘</span>J
            </kbd>
          </p>
        </Button>
        <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
          <GeneSearchCommand
            query={query}
            setQuery={setQuery}
            hasSearched={hasSearched}
            searchResults={searchResults}
            isLoading={isLoading}
            setIsOpen={setIsOpen}
            handleSelect={handleSelect}
            error={error}
          />
        </CommandDialog>
      </div>
    )
  }

  return (
    <GeneSearchCommand
      query={query}
      setQuery={setQuery}
      hasSearched={hasSearched}
      searchResults={searchResults}
      isLoading={isLoading}
      setIsOpen={setIsOpen}
      handleSelect={handleSelect}
      error={error}
    />
  )
}
