'use client'
import Link from 'next/link'
import { WandSparkles } from 'lucide-react'
import { SpeciesSelect } from '@/components/species-select'
import { GeneSearch } from '@/components/gene-search'
import { searchGenes } from '@/actions'
import { usePathname } from 'next/navigation'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Suspense } from 'react'

function GeneSearchTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/design-tool"
          className="hover:bg-muted mr-4 rounded-md p-2 text-gray-600 hover:text-gray-800"
        >
          <WandSparkles className="h-6 w-6" />
        </Link>
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
    <div className="sticky top-0 z-10 mb-1.5 flex items-center justify-between bg-white p-3 md:px-6">
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
