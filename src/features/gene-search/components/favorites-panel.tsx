'use client'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import Link from 'next/link'
import { geneHref } from '@/lib/bio/species'
import { ExpandableSidebarList } from '@/components/expandable-sidebar-list'
import { TruncatedText } from '@/components/truncated-text'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { X } from 'lucide-react'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.favoritesPanel

export function FavoriteGenes() {
  const { favoriteGenes, removeFavoriteGene } = useFavoriteGenes()

  return (
    <ExpandableSidebarList
      label={copy.label}
      items={favoriteGenes}
      getItemKey={(gene) => gene.id}
      emptyMessage={copy.empty}
      renderItem={(gene) => (
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" className="[&>svg]:size-3">
            <Link href={geneHref(gene.symbol, gene.species)}>
              {gene.species && (
                <SpeciesIcon
                  species={gene.species}
                  className="text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground flex-shrink-0"
                />
              )}
              <span className="font-mono font-medium">{gene.symbol}</span>
              <TruncatedText
                tooltip={gene.name}
                className="text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground truncate pr-5"
              >
                {gene.name}
              </TruncatedText>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuAction
            showOnHover
            onClick={() => removeFavoriteGene(gene.id)}
            aria-label={copy.removeAria(gene.symbol)}
          >
            <X />
          </SidebarMenuAction>
        </SidebarMenuItem>
      )}
    />
  )
}
