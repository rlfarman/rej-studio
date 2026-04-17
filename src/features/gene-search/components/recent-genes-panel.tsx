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
import { TruncatedText } from '@/components/truncated-text'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { X } from 'lucide-react'

export function RecentGenes() {
  const { recentGenes, clearRecentGenes, removeRecentGene } = useRecentGenes()

  return (
    <ExpandableSidebarList
      label="Recent Searches"
      items={recentGenes}
      getItemKey={(gene) => gene.id}
      onClear={clearRecentGenes}
      emptyMessage="Your recent gene searches will appear here."
      renderItem={(gene) => (
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" className="[&>svg]:size-3">
            <Link
              href={geneHref(gene.symbol, gene.species)}
              className="flex items-center gap-2"
            >
              {gene.species && (
                <SpeciesIcon
                  species={gene.species}
                  className="text-muted-foreground flex-shrink-0"
                />
              )}
              <span className="font-mono font-medium">{gene.symbol}</span>
              <TruncatedText
                tooltip={gene.name}
                className="text-muted-foreground truncate pr-5"
              >
                {gene.name}
              </TruncatedText>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuAction
            showOnHover
            onClick={() => removeRecentGene(gene.id)}
            aria-label={`Remove ${gene.symbol} from recent searches`}
            className="bg-sidebar hover:bg-sidebar-accent"
          >
            <X />
          </SidebarMenuAction>
        </SidebarMenuItem>
      )}
    />
  )
}
