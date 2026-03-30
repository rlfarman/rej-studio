'use client'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useFavoriteGenes } from '@/context/favorite-genes-context'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { X } from 'lucide-react'

export function FavoriteGenes() {
  const { favoriteGenes, removeFavoriteGene } = useFavoriteGenes()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarGroupContent>
        {favoriteGenes.length > 0 ? (
          <SidebarMenu>
            {favoriteGenes.map((gene) => (
              <SidebarMenuItem key={gene.id} className="group/item">
                <SidebarMenuButton asChild>
                  <Link href={`/genes/${gene.symbol}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="inline-block w-16 truncate text-center font-mono"
                        >
                          {gene.symbol}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{gene.symbol}</TooltipContent>
                    </Tooltip>
                    <span className="text-xs">{gene.name}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuAction
                  className="opacity-0 group-hover/item:opacity-100"
                  onClick={() => removeFavoriteGene(gene.id)}
                >
                  <X className="h-3 w-3" />
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
          <div className="text-muted-foreground p-4 text-xs">
            No favorites yet. Star a gene to save it here.
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
