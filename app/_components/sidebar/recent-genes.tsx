'use client'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Button } from '@/components/ui/button' // Import the Button component
export function RecentGenes() {
  const { recentGenes, clearRecentGenes } = useRecentGenes()

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
              <SidebarMenuItem key={gene.id}>
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
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
          <div className="text-muted-foreground p-4 text-xs">
            No recent searches yet. Search for genes to see them here!
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
