'use client'
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

export function FavoriteGenes() {
  const { favoriteGenes } = useFavoriteGenes()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarGroupContent>
        {favoriteGenes.length > 0 ? (
          <SidebarMenu>
            {favoriteGenes.map((gene) => (
              <SidebarMenuItem key={gene.id}>
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
            No favorite genes yet. Add some to see them here!
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
