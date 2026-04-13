'use client'
import { Dna } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { FavoriteGenes } from '@/features/gene-search/components/favorites-panel'
import { RecentGenes } from '@/features/gene-search/components/recent-genes-panel'
import { RecentJobs } from '@/features/design-tool/components/recent-jobs-panel'
import { JobWatcher } from '@/features/design-tool/components/job-watcher'
import { SidebarMenu } from '@/app/_components/layout/sidebar-menu'
import { SidebarToggle } from '@/app/_components/layout/sidebar-toggle'
import type { JobHistoryEntry } from '@/features/design-tool/hooks/use-job-history'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()

  function handleSelectJob(entry: JobHistoryEntry) {
    router.push(`/design-tool?job=${entry.id}`)
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link
          href="/"
          className="hover:text-primary group flex items-center hover:underline"
        >
          <Dna className="mt-2 ml-2 size-6 transition-transform duration-300 group-hover:rotate-12" />
          <span className="mt-2 ml-2 font-mono text-lg font-semibold">
            REJ Studio
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <FavoriteGenes />
        <RecentGenes />
        <RecentJobs onSelectJob={handleSelectJob} />
      </SidebarContent>
      <JobWatcher />
      <SidebarFooter>
        <div className="flex items-center gap-2">
          <SidebarMenu />
          <div className="flex-1" />
          <SidebarToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
