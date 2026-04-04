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
import { SidebarTrigger } from '@/components/ui/sidebar'

function GeneSearchTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" asChild>
          <Link href="/design-tool" aria-label="Go to Design Tool">
            <WandSparkles className="size-5" />
            Design Tool
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Go to Design Tool</TooltipContent>
    </Tooltip>
  )
}

export function Header() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const isDesignToolPage = pathname === '/design-tool'

  // Extract the gene symbol from the path
  const geneSymbolMatch = pathname.match(/\/genes\/([^/]+)/)
  const geneSymbol = geneSymbolMatch ? geneSymbolMatch[1] : undefined

  return (
    <header className="bg-background sticky top-0 z-10 mb-1.5 flex items-center justify-between p-3 md:px-6">
      <div className="flex w-full items-center justify-between xl:justify-normal">
        <div className="z-10 flex items-center">
          <SidebarTrigger size="lg" />
          <GeneSearchTooltip />
        </div>
        {!isDesignToolPage && (
          <Suspense fallback={<div className="h-9 w-32" />}>
            <SpeciesSelect />
          </Suspense>
        )}
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
