'use client'
import Link from 'next/link'
import { WandSparkles } from 'lucide-react'
import { SpeciesSelect } from '@/components/_header/species-select'
import { GeneSearch } from '@/components/gene-search'
import { searchGenes } from '@/actions'
import { usePathname } from 'next/navigation'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'

function GeneSearchTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" asChild>
          <Link href="/design-tool">
            <WandSparkles className="size-5" />
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
    <div className="sticky top-0 z-10 mb-1.5 flex items-center justify-between p-3 md:px-6">
      <div className="flex w-full items-center justify-between lg:justify-normal">
        <GeneSearchTooltip />
        {!isDesignToolPage && (
          <Suspense>
            <SpeciesSelect />
          </Suspense>
        )}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 transform">
        {!isHomePage && (
          <GeneSearch
            searchGenes={searchGenes}
            defaultQuery={geneSymbol}
            isDialog
          />
        )}
      </div>
    </div>
  )
}
