'use client'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import { Link } from '@tanstack/react-router'
import { geneLink } from '../utils/search-href'
import { ExpandableSidebarList } from '@/components/expandable-sidebar-list'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { X } from 'lucide-react'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.favoritesPanel

export function FavoriteGenes() {
  const { favoriteGenes, removeFavoriteGene } = useFavoriteGenes()

  return (
    <ExpandableSidebarList
      label={copy.label}
      persistKey="sidebar:favorites:open"
      items={favoriteGenes}
      getItemKey={(gene) => gene.id}
      renderItem={(gene) => (
        <SidebarMenuItem>
          <SidebarMenuButton
            size="sm"
            className="h-auto items-start py-1.5 [&>svg]:size-3"
            render={<Link {...geneLink(gene.symbol, gene.species)} />}
          >
            {gene.species && (
              <SpeciesIcon
                species={gene.species}
                className="mt-0.5 flex-shrink-0 text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
              <span className="font-mono font-medium">{gene.symbol}</span>
              <span className="line-clamp-2 pr-5 type-nano text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground">
                {gene.name}
              </span>
            </div>
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
