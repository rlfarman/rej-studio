'use client'
import { useRef, useState, useTransition } from 'react'
import { CommandDialog } from '@/components/ui/command'
import { useNavigate } from '@tanstack/react-router'
import { useGeneSearch } from '@/features/gene-search/hooks/use-gene-search'
import { usePrefetchGeneIndex } from '@/features/gene-search/hooks/use-prefetch-gene-index'
import { GeneSearchCommand } from './gene-search-command'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import { useSpeciesContext } from '@/stores/species-store'
import {
  geneLink,
  searchPageLink,
} from '@/features/gene-search/utils/search-href'
import type {
  SavedGene,
  JobSearchItem,
} from '@/features/gene-search/types/domain-types'
import { useSearchShortcut } from '@/hooks/use-search-shortcut'

interface GeneSearchProperties {
  defaultQuery?: string
  isDialog?: boolean
  // Jobs to merge into search results. Supplied by the app-level shell so
  // `GeneSearch` doesn't need to cross the feature boundary into `design-tool`.
  jobs?: JobSearchItem[]
  onSelectJob?: (id: string) => void
  /**
   * The dialog's open state, owned by GeneSearchTrigger, which renders the
   * button and loads this component only once the palette is wanted.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const EMPTY_JOBS: JobSearchItem[] = []

export function GeneSearch({
  defaultQuery,
  isDialog = false,
  jobs = EMPTY_JOBS,
  onSelectJob,
  open,
  onOpenChange,
}: GeneSearchProperties) {
  // Start the index download before anyone types (also started by the
  // header's trigger; the worker loads it once).
  usePrefetchGeneIndex()
  const navigate = useNavigate()
  const {
    query,
    setQuery,
    searchNow,
    hasSearched,
    searchResults,
    truncated,
    suggestions,
    isLoading,
    error,
    retry,
  } = useGeneSearch({ defaultQuery })
  const { species } = useSpeciesContext()
  const [isOpenState, setIsOpenState] = useState(false)
  const isOpen = open ?? isOpenState
  const setIsOpen = onOpenChange ?? setIsOpenState
  const [pendingGene, setPendingGene] = useState<SavedGene | null>(null)
  const [, startTransition] = useTransition()
  const { recentGenes, addRecentGene } = useRecentGenes()
  const { favoriteGenes } = useFavoriteGenes()

  const handleSelect = (gene: SavedGene) => {
    addRecentGene(gene)
    // Show the in-place "Opening X…" loader immediately as an urgent update.
    setPendingGene(gene)
    // Close the dialog, reset the query and clear the loader together once
    // the router has loaded the destination (navigate() resolves then).
    startTransition(async () => {
      await navigate(geneLink(gene.symbol, gene.species, gene.matchedIsoformId))
      startTransition(() => {
        setIsOpen(false)
        setQuery(gene.symbol)
        setPendingGene(null)
      })
    })
  }

  const handleSelectJob = (entry: JobSearchItem) => {
    setIsOpen(false)
    onSelectJob?.(entry.id)
  }

  // The palette shows a handful of genes; the /genes page shows the rest.
  const handleSeeAll = () => {
    setIsOpen(false)
    void navigate(searchPageLink(query.trim(), species))
  }

  // On a page with the inline search (home), ⌘K focuses that box. The
  // dialog's ⌘K belongs to GeneSearchTrigger, which is always mounted.
  const inputRef = useRef<HTMLInputElement>(null)
  useSearchShortcut(() => {
    if (isDialog) return
    inputRef.current?.focus()
    inputRef.current?.select()
  })

  if (isDialog) {
    return (
      <>
        <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
          <GeneSearchCommand
            query={query}
            setQuery={setQuery}
            searchNow={searchNow}
            hasSearched={hasSearched}
            searchResults={searchResults}
            truncated={truncated}
            suggestions={suggestions}
            onSeeAll={handleSeeAll}
            isLoading={isLoading}
            setIsOpen={setIsOpen}
            handleSelect={handleSelect}
            error={error}
            retry={retry}
            recentGenes={recentGenes}
            favoriteGenes={favoriteGenes}
            jobs={jobs}
            handleSelectJob={handleSelectJob}
            pendingGene={pendingGene}
          />
        </CommandDialog>
      </>
    )
  }

  return (
    <GeneSearchCommand
      query={query}
      setQuery={setQuery}
      searchNow={searchNow}
      inputRef={inputRef}
      shortcutHint
      hasSearched={hasSearched}
      searchResults={searchResults}
      truncated={truncated}
      suggestions={suggestions}
      onSeeAll={handleSeeAll}
      isLoading={isLoading}
      setIsOpen={setIsOpen}
      handleSelect={handleSelect}
      error={error}
      retry={retry}
      recentGenes={recentGenes}
      favoriteGenes={favoriteGenes}
      jobs={jobs}
      handleSelectJob={handleSelectJob}
      pendingGene={pendingGene}
    />
  )
}
