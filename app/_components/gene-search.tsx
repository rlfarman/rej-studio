'use client'
import { useEffect, useState } from 'react'
import { CommandDialog } from '@/components/ui/command'
import { useRouter } from 'next/navigation'
import { createSearch, type GeneSearchResult } from '@/actions'
import { Button } from './ui/button'
import { SearchIcon } from 'lucide-react'
import { useGeneSearch } from '@/hooks/useGeneSearch'
import { GeneSearchCommand } from './_gene-search/gene-search-command'

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
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (
    gene: Pick<GeneSearchResult, 'symbol' | 'id' | 'name'>
  ) => {
    setIsOpen(false)
    createSearch({
      query,
      geneId: gene.id,
      userId: 'abcd1234',
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
      <>
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="text-muted-foreground hover:text-muted-foreground min-w-42 sm:min-w-96 md:min-w-72 xl:min-w-108 w-full cursor-pointer justify-between"
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
          <GeneSearchCommand
            query={query}
            setQuery={setQuery}
            hasSearched={hasSearched}
            searchResults={searchResults}
            isLoading={isLoading}
            setIsOpen={setIsOpen}
            handleSelect={handleSelect}
          />
        </CommandDialog>
      </>
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
    />
  )
}
