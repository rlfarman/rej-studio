'use client'
import { DnaIcon } from '@/components/dna-icon'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { FavoriteGenes } from './favorite-genes'
import { RecentGenes } from './recent-genes'
import Link from 'next/link'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link
          href="/"
          className="hover:text-primary group flex items-center hover:underline"
        >
          <DnaIcon className="mt-2 ml-2 size-6 transition-transform duration-300 group-hover:rotate-12" />
          <span className="mt-2 ml-2 font-mono text-lg font-semibold">
            REJ Studio
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <RecentGenes />
        <FavoriteGenes />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
