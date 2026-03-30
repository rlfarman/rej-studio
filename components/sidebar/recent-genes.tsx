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
import { useRecentGenes } from '@/context/recent-genes-context'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function RecentGenes() {
  const { recentGenes, removeRecentGene, clearRecentGenes } = useRecentGenes()

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
          <SidebarMenu>
            {recentGenes.map((gene) => (
              <SidebarMenuItem key={gene.id} className="group/item">
                <SidebarMenuButton asChild>
                  <Link
                    href={`/genes/${gene.symbol}`}
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
                <SidebarMenuAction
                  className="opacity-0 group-hover/item:opacity-100"
                  onClick={() => removeRecentGene(gene.id)}
                >
                  <X className="h-3 w-3" />
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
          <div className="text-muted-foreground p-4 text-xs">
            Your recent gene searches will appear here.
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
