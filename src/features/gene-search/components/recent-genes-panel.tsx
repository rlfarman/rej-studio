'use client'
import { useState } from 'react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import Link from 'next/link'
import { geneHref } from '@/lib/bio/species'
import { Button } from '@/components/ui/button'
import { TruncatedText } from '@/components/truncated-text'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { X } from 'lucide-react'

const COLLAPSED_COUNT = 5
const EXPANDED_MAX = 15

export function RecentGenes() {
  const { recentGenes, clearRecentGenes, removeRecentGene } = useRecentGenes()
  const [expanded, setExpanded] = useState(false)

  const hiddenCount = recentGenes.length - COLLAPSED_COUNT
  const visibleItems = expanded
    ? recentGenes.slice(0, EXPANDED_MAX)
    : recentGenes.slice(0, COLLAPSED_COUNT)

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between">
        <SidebarGroupLabel>Recent Searches</SidebarGroupLabel>
        {recentGenes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearRecentGenes}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>
      <SidebarGroupContent>
        {recentGenes.length > 0 ? (
          <>
            <SidebarMenu
              className={expanded ? 'max-h-80 overflow-y-auto' : undefined}
            >
              {visibleItems.map((gene) => (
                <SidebarMenuItem key={gene.id}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={geneHref(gene.symbol, gene.species)}
                      className="flex items-center gap-2"
                    >
                      {gene.species && (
                        <SpeciesIcon
                          species={gene.species}
                          className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0"
                        />
                      )}
                      <span className="font-mono font-medium">
                        {gene.symbol}
                      </span>
                      <TruncatedText
                        tooltip={gene.name}
                        className="text-muted-foreground truncate pr-5 text-xs"
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
              ))}
            </SidebarMenu>
            {hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground w-full text-xs"
              >
                {expanded ? 'Show less' : `+ Show ${hiddenCount} more`}
              </Button>
            )}
          </>
        ) : (
          <div className="text-muted-foreground p-4 text-xs">
            Your recent gene searches will appear here.
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
