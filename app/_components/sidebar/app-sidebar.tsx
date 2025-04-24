'use client'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { FavoriteGenes } from './favorite-genes'
import { RecentGenes } from './recent-genes'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <span className="ml-2 mt-2 font-mono text-lg font-semibold">
          REJ Studio
        </span>
      </SidebarHeader>
      <SidebarContent>
        <RecentGenes />
        <FavoriteGenes />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
