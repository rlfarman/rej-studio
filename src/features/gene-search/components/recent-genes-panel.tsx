'use client'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import Link from 'next/link'
import { geneHref } from '@/lib/bio/species'
import { ExpandableSidebarList } from '@/components/expandable-sidebar-list'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { X } from 'lucide-react'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.recentGenesPanel

export function RecentGenes() {
  const { recentGenes, clearRecentGenes, removeRecentGene } = useRecentGenes()

  return (
    <ExpandableSidebarList
      label={copy.label}
      items={recentGenes}
      getItemKey={(gene) => gene.id}
      onClear={clearRecentGenes}
      emptyMessage={copy.empty}
      renderItem={(gene) => (
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="sm"
            className="h-auto items-start py-1.5 [&>svg]:size-3"
          >
            <Link
              href={geneHref(gene.symbol, gene.species)}
              className="flex items-start gap-2"
            >
              {gene.species && (
                <SpeciesIcon
                  species={gene.species}
                  className="text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground mt-0.5 flex-shrink-0"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                <span className="font-mono font-medium">{gene.symbol}</span>
                <span className="text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground line-clamp-2 pr-5 text-[11px]">
                  {gene.name}
                </span>
              </div>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuAction
            showOnHover
            onClick={() => removeRecentGene(gene.id)}
            aria-label={copy.removeAria(gene.symbol)}
          >
            <X />
          </SidebarMenuAction>
        </SidebarMenuItem>
      )}
    />
  )
}
