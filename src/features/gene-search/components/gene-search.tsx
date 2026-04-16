'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { CommandDialog } from '@/components/ui/command'
import { useRouter } from 'next/navigation'
import { type SearchGenesResult } from '@/features/gene-search/api/genes'
import { Button } from '@/components/ui/button'
import { SearchIcon } from 'lucide-react'
import { useGeneSearch } from '@/features/gene-search/hooks/use-gene-search'
import { GeneSearchCommand } from './gene-search-command'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import { geneHref, type SpeciesFilter } from '@/lib/bio/species'
import type { SavedGene } from '@/features/gene-search/types/domain-types'
import { trackEvent } from '@/lib/analytics'
import { geneSearchCopy } from '@/features/gene-search/copy'

interface GeneSearchProperties {
  searchGenes: (
    content: string,
    species?: SpeciesFilter,
  ) => Promise<SearchGenesResult>
  defaultQuery?: string
  isDialog?: boolean
}

function subscribeToPlatformStore() {
  return () => {}
}

function getPlatformSnapshot() {
  return /Mac|iPod|iPhone|iPad/.test(window.navigator.userAgent)
}

function getPlatformServerSnapshot() {
  return false
}

export function GeneSearch({
  searchGenes,
  defaultQuery,
  isDialog = false,
}: GeneSearchProperties) {
  const router = useRouter()
  const {
    query,
    setQuery,
    hasSearched,
    searchResults,
    isLoading,
    error,
    retry,
  } = useGeneSearch({
    searchGenes,
    defaultQuery,
  })
  const [isOpen, setIsOpen] = useState(false)
  const { recentGenes, addRecentGene } = useRecentGenes()
  const { favoriteGenes } = useFavoriteGenes()
  const isMac = useSyncExternalStore(
    subscribeToPlatformStore,
    getPlatformSnapshot,
    getPlatformServerSnapshot,
  )

  const handleSelect = (gene: SavedGene) => {
    setIsOpen(false)
    addRecentGene(gene)
    trackEvent({
      event: 'gene_select',
      symbol: gene.symbol,
      species: gene.species ?? 'unknown',
      isoform_id: gene.matchedIsoformId,
    })
    router.push(geneHref(gene.symbol, gene.species, gene.matchedIsoformId))
    setQuery(gene.symbol)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
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
          className="text-muted-foreground hover:text-muted-foreground w-full min-w-42 cursor-pointer justify-between md:min-w-72 xl:min-w-108"
        >
          <div className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5" />
            <span>{geneSearchCopy.search.triggerLabel}</span>
          </div>
          <p className="text-muted-foreground hidden text-sm md:block">
            {geneSearchCopy.search.pressKey}{' '}
            <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
              <span className="text-xs">{isMac ? '⌘' : 'Ctrl+'}</span>K
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
            retry={retry}
            recentGenes={recentGenes}
            favoriteGenes={favoriteGenes}
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
      retry={retry}
      recentGenes={recentGenes}
      favoriteGenes={favoriteGenes}
    />
  )
}
