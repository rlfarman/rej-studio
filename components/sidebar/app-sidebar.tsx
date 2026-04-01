'use client'
import { DnaIcon } from '@/components/dna-icon'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { FavoriteGenes } from './favorite-genes'
import { RecentGenes } from './recent-genes'
import { RecentJobs } from './recent-jobs'
import { ThemeToggle } from '@/components/theme-toggle'
import { SidebarToggle } from '@/components/sidebar-toggle'
import { DataTransfer } from './data-transfer'
import { useJobHistoryContext } from '@/context/job-history-context'
import Link from 'next/link'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { selectEntry } = useJobHistoryContext()

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
        <FavoriteGenes />
        <RecentGenes />
        <RecentJobs onSelectJob={selectEntry} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DataTransfer />
          <div className="flex-1" />
          <SidebarToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
