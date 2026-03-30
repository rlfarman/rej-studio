'use client'
import Image from 'next/image'
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
          <Image
            src="/images/dna.svg"
            alt="REJ Studio Logo"
            width={24}
            height={24}
            className="mt-2 ml-2 transition-transform duration-300 group-hover:rotate-12 dark:invert"
          />
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
