'use client'
import Link from 'next/link'
import { WandSparkles } from 'lucide-react'
import SpeciesSelect from '@/components/species-select'
import GeneSearch from '@/search/components/gene-search'
import { searchGenes } from '@/actions'
import { usePathname } from 'next/navigation'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

export default function Header() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'

  // Extract the gene symbol from the path
  const geneSymbolMatch = pathname.match(/\/genes\/([^/]+)/)
  const geneSymbol = geneSymbolMatch ? geneSymbolMatch[1] : undefined

  return (
    <div className="sticky top-0 z-10 mb-1.5 flex items-center justify-between bg-white p-3 font-semibold md:px-6">
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/design-tool"
              className="mr-4 p-2 text-gray-600 hover:text-gray-800"
            >
              <WandSparkles className="h-6 w-6" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Go to Design Tool</TooltipContent>
        </Tooltip>
        <SpeciesSelect />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 transform">
        {!isHomePage && (
          <div>
            <GeneSearch
              searchGenes={searchGenes}
              hideByDefault={!isHomePage}
              defaultQuery={geneSymbol}
            />
          </div>
        )}
      </div>
    </div>
  )
}
