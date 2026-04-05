'use client'
import Link from 'next/link'
import { WandSparkles } from 'lucide-react'
import { SpeciesSelect } from '@/components/bio/species-select'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import { searchGenes } from '@/features/gene-search/api/genes'
import { usePathname } from 'next/navigation'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

function GeneSearchTooltip() {
  const { state } = useSidebar()
  // When the sidebar is open it eats enough width that the centered
  // search bar and the "Design Tool" label can collide — push the label
  // one breakpoint higher while the sidebar is expanded.
  const labelClass =
    state === 'expanded' ? 'hidden md:inline' : 'hidden sm:inline'
  const tooltipHiddenClass = state === 'expanded' ? 'md:hidden' : 'sm:hidden'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" asChild>
          <Link href="/design-tool" aria-label="Go to Design Tool">
            <WandSparkles className="size-5" />
            <span className={labelClass}>Design Tool</span>
          </Link>
        </Button>
      </TooltipTrigger>
      {/* Redundant once the label is visible; only show when label is hidden */}
      <TooltipContent className={tooltipHiddenClass}>
        Go to Design Tool
      </TooltipContent>
    </Tooltip>
  )
}

export function Header() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const { state } = useSidebar()
  const sidebarLabel = state === 'expanded' ? 'Close sidebar' : 'Open sidebar'
  // Keep the species label in sync with the Design Tool label breakpoint —
  // they share the same row so they should appear/disappear together.
  const headerLabelClass =
    state === 'expanded' ? 'hidden md:block' : 'hidden sm:block'

  // Extract the gene symbol from the path
  const geneSymbolMatch = pathname.match(/\/genes\/([^/]+)/)
  const geneSymbol = geneSymbolMatch ? geneSymbolMatch[1] : undefined

  return (
    <header className="bg-background sticky top-0 z-10 mb-1.5 flex items-center justify-between p-3 md:px-6">
      <div className="flex w-full items-center justify-between xl:justify-normal">
        <div className="z-10 flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger size="lg" aria-label={sidebarLabel} />
            </TooltipTrigger>
            <TooltipContent>{sidebarLabel}</TooltipContent>
          </Tooltip>
          <GeneSearchTooltip />
        </div>
        <Suspense fallback={<div className="h-9 w-32" />}>
          <SpeciesSelect labelVisibilityClass={headerLabelClass} />
        </Suspense>
      </div>
      <div className="absolute left-1/2 flex w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 transform justify-center">
        {!isHomePage && (
          <GeneSearch
            searchGenes={searchGenes}
            defaultQuery={geneSymbol}
            isDialog
          />
        )}
      </div>
    </header>
  )
}
