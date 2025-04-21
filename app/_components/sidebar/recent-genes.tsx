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

export function RecentGenes() {
  const { recentGenes } = useRecentGenes()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Recent Searches</SidebarGroupLabel>
      <SidebarGroupContent>
        {recentGenes.length > 0 ? (
          <SidebarMenu>
            {recentGenes.map((gene) => (
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href={`/genes/${gene.symbol}`}>
                    <Badge
                      variant="outline"
                      className="inline-block w-16 truncate text-center font-mono"
                    >
                      {gene.symbol}
                    </Badge>
                    <span className="text-xs">{gene.name}</span>
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
