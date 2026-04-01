'use client'
import { useState } from 'react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useFavoriteGenes } from '@/context/favorite-genes-context'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { geneHref } from '@/lib/species'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Button } from '@/components/ui/button'

const COLLAPSED_COUNT = 5
const EXPANDED_MAX = 15

export function FavoriteGenes() {
  const { favoriteGenes } = useFavoriteGenes()
  const [expanded, setExpanded] = useState(false)

  const hiddenCount = favoriteGenes.length - COLLAPSED_COUNT
  const visibleItems = expanded
    ? favoriteGenes.slice(0, EXPANDED_MAX)
    : favoriteGenes.slice(0, COLLAPSED_COUNT)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarGroupContent>
        {favoriteGenes.length > 0 ? (
          <>
            <SidebarMenu
              className={
                expanded ? 'max-h-80 overflow-y-auto' : undefined
              }
            >
              {visibleItems.map((gene) => (
                <SidebarMenuItem key={gene.id}>
                  <SidebarMenuButton asChild>
                    <Link href={geneHref(gene.symbol, gene.species)}>
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
                  ? 'Show less'
                  : `+ Show ${hiddenCount} more`}
              </Button>
            )}
          </>
        ) : (
          <div className="text-muted-foreground p-4 text-xs">
            No favorites yet. Star a gene to save it here.
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
