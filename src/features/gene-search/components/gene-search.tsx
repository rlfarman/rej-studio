'use client'
import { useRef, useState, useTransition } from 'react'
import { CommandDialog } from '@/components/ui/command'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Kbd, ModKey } from '@/components/ui/kbd'
import { SearchIcon } from 'lucide-react'
import { useGeneSearch } from '@/features/gene-search/hooks/use-gene-search'
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
import { trackEvent } from '@/lib/analytics'
import { useSearchShortcut } from '@/hooks/use-search-shortcut'
import { geneSearchCopy } from '../copy'

interface GeneSearchProperties {
  defaultQuery?: string
  isDialog?: boolean
  // Jobs to merge into search results. Supplied by the app-level shell so
  // `GeneSearch` doesn't need to cross the feature boundary into `design-tool`.
  jobs?: JobSearchItem[]
  onSelectJob?: (id: string) => void
}

const EMPTY_JOBS: JobSearchItem[] = []

export function GeneSearch({
  defaultQuery,
  isDialog = false,
  jobs = EMPTY_JOBS,
  onSelectJob,
}: GeneSearchProperties) {
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
  const [isOpen, setIsOpen] = useState(false)
  const [pendingGene, setPendingGene] = useState<SavedGene | null>(null)
  const [, startTransition] = useTransition()
  const { recentGenes, addRecentGene } = useRecentGenes()
  const { favoriteGenes } = useFavoriteGenes()

  const handleSelect = (gene: SavedGene) => {
    addRecentGene(gene)
    trackEvent({
      event: 'gene_select',
      symbol: gene.symbol,
      species: gene.species ?? 'unknown',
      isoform_id: gene.matchedIsoformId,
    })
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

  // ⌘K toggles the palette; on a page with the inline search (home), it
  // focuses that box instead.
  const inputRef = useRef<HTMLInputElement>(null)
  useSearchShortcut(() => {
    if (isDialog) {
      setIsOpen((isOpen) => !isOpen)
    } else {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  })

  if (isDialog) {
    return (
      <div>
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="group w-full min-w-42 cursor-pointer justify-between text-muted-foreground hover:text-accent-foreground md:min-w-72 xl:min-w-108"
        >
          <div className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5" />
            <span>{geneSearchCopy.trigger.label}</span>
          </div>
          <p className="hidden text-sm text-muted-foreground group-hover:text-accent-foreground md:block">
            {geneSearchCopy.trigger.kbdHintPrefix}{' '}
            <Kbd>
              <ModKey /> K
            </Kbd>
          </p>
        </Button>
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
      </div>
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
