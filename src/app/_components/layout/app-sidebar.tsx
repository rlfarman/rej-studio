'use client'
import { DnaIcon } from '@/components/bio/dna-icon'
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
import { ThemeToggle } from '@/app/_components/layout/theme-toggle'
import { SidebarToggle } from '@/app/_components/layout/sidebar-toggle'
import { DataTransfer } from '@/app/_components/data-transfer'
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
          <DnaIcon className="mt-2 ml-2 size-6 transition-transform duration-300 group-hover:rotate-12" />
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
      <SidebarFooter>
        <div className="flex flex-col gap-1">
          <ThemeToggle />
        </div>
        <DataTransfer />
        <div className="flex items-center gap-2">
          <div className="flex-1" />
          <SidebarToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
