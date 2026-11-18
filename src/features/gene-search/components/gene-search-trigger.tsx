import { lazy, Suspense, useState } from 'react'
import { SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Kbd, ModKey } from '@/components/ui/kbd'
import { useSearchShortcut } from '@/hooks/use-search-shortcut'

import { geneSearchCopy } from '../copy'
import { usePrefetchGeneIndex } from '../hooks/use-prefetch-gene-index'
import type { JobSearchItem } from '../types/domain-types'

/**
 * The header's search button, with the palette loaded only when it is
 * wanted.
 *
 * The palette (the autocomplete list and its rows, and the search query
 * hooks) is ~24 KB of gzipped JavaScript that every page used to load up
 * front. It
 * now loads on the first hover, focus, click or ⌘K, which is well before it
 * is needed: hovering the button starts it.
 */

const loadGeneSearch = () => import('./gene-search')
const GeneSearch = lazy(() =>
  loadGeneSearch().then((module) => ({ default: module.GeneSearch })),
)

interface GeneSearchTriggerProps {
  jobs?: JobSearchItem[]
  onSelectJob?: (id: string) => void
}

export function GeneSearchTrigger({
  jobs,
  onSelectJob,
}: GeneSearchTriggerProps) {
  // The button is in the header of every page: start the index download
  // from here, before anyone types.
  usePrefetchGeneIndex()
  const [open, setOpen] = useState(false)
  // Mounted from the first time it is opened, then kept, so reopening is
  // instant and the dialog can animate closed.
  const [wanted, setWanted] = useState(false)

  const openPalette = () => {
    setWanted(true)
    setOpen(true)
  }
  useSearchShortcut(() => {
    setWanted(true)
    setOpen((isOpen) => !isOpen)
  })
  const preload = () => {
    void loadGeneSearch()
  }

  return (
    <div>
      <Button
        variant="outline"
        onClick={openPalette}
        onPointerEnter={preload}
        onFocus={preload}
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
      {wanted && (
        <Suspense fallback={null}>
          <GeneSearch
            isDialog
            open={open}
            onOpenChange={setOpen}
            jobs={jobs}
            onSelectJob={onSelectJob}
          />
        </Suspense>
      )}
    </div>
  )
}
