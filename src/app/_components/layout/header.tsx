'use client'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import { searchGenes } from '@/features/gene-search/api/genes'
import { usePathname } from 'next/navigation'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { appCopy } from '@/lib/copy'

export function Header() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const { state } = useSidebar()
  const sidebarLabel =
    state === 'expanded'
      ? appCopy.sidebar.closeLabel
      : appCopy.sidebar.openLabel

  // Extract the gene symbol from the path
  const geneSymbolMatch = pathname.match(/\/genes\/([^/]+)/)
  const geneSymbol = geneSymbolMatch ? geneSymbolMatch[1] : undefined

  return (
    <header className="bg-background sticky top-0 z-10 mb-1.5 flex min-h-15 items-center p-3 md:px-6">
      <div className="z-10 flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger size="lg" aria-label={sidebarLabel} />
          </TooltipTrigger>
          <TooltipContent>{sidebarLabel}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-1 justify-center">
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
