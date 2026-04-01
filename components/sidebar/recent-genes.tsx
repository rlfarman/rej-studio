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
import { useRecentGenes } from '@/context/recent-genes-context'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { geneHref } from '@/lib/species'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Button } from '@/components/ui/button'

const COLLAPSED_COUNT = 5
const EXPANDED_MAX = 15

export function RecentGenes() {
  const { recentGenes, clearRecentGenes } = useRecentGenes()
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
              className={
                expanded ? 'max-h-80 overflow-y-auto' : undefined
              }
            >
              {visibleItems.map((gene) => (
                <SidebarMenuItem key={gene.id}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={geneHref(gene.symbol, gene.species)}
                      className="flex items-center gap-2"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="inline-block w-16 flex-shrink-0 truncate text-center font-mono"
                          >
                            {gene.symbol}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{gene.symbol}</TooltipContent>
                      </Tooltip>
                      <span className="truncate text-xs">{gene.name}</span>
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
            Your recent gene searches will appear here.
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
