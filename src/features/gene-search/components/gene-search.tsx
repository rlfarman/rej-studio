import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useNavigate } from '@tanstack/react-router'
import { useGeneSearch } from '@/features/gene-search/hooks/use-gene-search'
import { usePrefetchGeneIndex } from '@/features/gene-search/hooks/use-prefetch-gene-index'
import { usePreTypedQuery } from '@/features/gene-search/hooks/use-pre-typed-query'
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
import { geneSearchCopy } from '../copy'

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
  // Text typed into the prerendered box before the app hydrated counts as
  // the query, so it isn't wiped and is searched for on mount.
  const initialQuery = usePreTypedQuery(defaultQuery, { enabled: !isDialog })
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
  } = useGeneSearch({ defaultQuery: initialQuery })
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

  if (isDialog) {
    return (
      <>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent
            className="top-1/3 translate-y-0 overflow-hidden rounded-3xl! p-0"
            showCloseButton={false}
          >
            <DialogTitle className="sr-only">
              {geneSearchCopy.command.dialogTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {geneSearchCopy.command.dialogDescription}
            </DialogDescription>
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
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <GeneSearchCommand
      query={query}
      setQuery={setQuery}
      searchNow={searchNow}
      onPage
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
