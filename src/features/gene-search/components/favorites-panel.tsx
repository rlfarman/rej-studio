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
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import Link from 'next/link'
import { geneHref } from '@/lib/bio/species'
import { Button } from '@/components/ui/button'
import { TruncatedText } from '@/components/truncated-text'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { X } from 'lucide-react'
import { geneSearchCopy } from '@/features/gene-search/copy'

const COLLAPSED_COUNT = 3
const EXPANDED_MAX = 15

export function FavoriteGenes() {
  const { favoriteGenes, removeFavoriteGene } = useFavoriteGenes()
  const [expanded, setExpanded] = useState(false)

  const hiddenCount = favoriteGenes.length - COLLAPSED_COUNT
  const visibleItems = expanded
    ? favoriteGenes.slice(0, EXPANDED_MAX)
    : favoriteGenes.slice(0, COLLAPSED_COUNT)

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="bg-sidebar sticky top-0 z-10">
        {geneSearchCopy.favoritesPanel.heading}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {favoriteGenes.length > 0 ? (
          <>
            <SidebarMenu>
              {visibleItems.map((gene) => (
                <SidebarMenuItem key={gene.id}>
                  <SidebarMenuButton asChild>
                    <Link href={geneHref(gene.symbol, gene.species)}>
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
                    onClick={() => removeFavoriteGene(gene.id)}
                    aria-label={geneSearchCopy.favoritesPanel.removeAriaLabel(
                      gene.symbol,
                    )}
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
                {expanded
                  ? geneSearchCopy.favoritesPanel.showLess
                  : geneSearchCopy.favoritesPanel.showMore(hiddenCount)}
              </Button>
            )}
          </>
        ) : (
          <div className="text-muted-foreground p-4 text-xs">
            {geneSearchCopy.favoritesPanel.emptyState}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
