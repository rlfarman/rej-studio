'use client'
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
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

export function Header() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const { state } = useSidebar()
  const sidebarLabel = state === 'expanded' ? 'Close sidebar' : 'Open sidebar'
  const headerLabelClass =
    state === 'expanded' ? 'hidden lg:block' : 'hidden sm:block'

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
