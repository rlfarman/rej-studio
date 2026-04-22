'use client'
import Image from 'next/image'
import { Dna } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu as SidebarMenuPrimitive,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { FavoriteGenes } from '@/features/gene-search/components/favorites-panel'
import { RecentGenes } from '@/features/gene-search/components/recent-genes-panel'
import { RecentJobs } from '@/features/design-tool/components/recent-jobs-panel'
import { JobWatcher } from '@/features/design-tool/components/job-watcher'
import { SidebarMenu } from '@/app/_components/layout/sidebar-menu'
import type { JobHistoryEntry } from '@/features/design-tool/hooks/use-job-history'
import { Home, WandSparkles, Activity } from 'lucide-react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const pathname = usePathname()

  function handleSelectJob(entry: JobHistoryEntry) {
    router.push(`/design-tool?job=${entry.id}`)
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenuPrimitive>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="REJ Studio">
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center">
                  <Dna className="size-5" />
                </div>
                <div className="grid flex-1 text-left leading-tight opacity-0 transition-opacity duration-150 group-data-[state=expanded]:opacity-100 group-data-[state=expanded]:delay-200 [[data-mobile=true]_&]:opacity-100">
                  <span className="font-display truncate text-base font-semibold">
                    REJ Studio
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenuPrimitive>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenuPrimitive>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/'}
                tooltip="Home"
              >
                <Link href="/">
                  <Home />
                  <span>Home</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/design-tool')}
                tooltip="Design Tool"
              >
                <Link href="/design-tool">
                  <WandSparkles />
                  <span>Design Tool</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem data-tour="nav-disease">
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/disease-associations')}
                tooltip="Disease Associations"
              >
                <Link href="/disease-associations">
                  <Activity />
                  <span>Disease Associations</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenuPrimitive>
        </SidebarGroup>
        <div
          data-tour="sidebar-history"
          className="min-w-0 opacity-0 transition-opacity duration-150 group-data-[collapsible=icon]:max-h-0 group-data-[collapsible=icon]:overflow-hidden group-data-[state=expanded]:opacity-100 group-data-[state=expanded]:delay-200 [[data-mobile=true]_&]:max-h-none [[data-mobile=true]_&]:opacity-100"
        >
          <FavoriteGenes />
          <RecentGenes />
          <RecentJobs onSelectJob={handleSelectJob} />
        </div>
      </SidebarContent>
      <JobWatcher />
      <SidebarFooter>
        <SidebarMenuPrimitive>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Salk Institute">
              <a
                href="https://www.salk.edu"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/branding/SalkLogo-WCB-K.png"
                  alt="Salk Institute"
                  width={16}
                  height={16}
                  className="block size-4 object-contain dark:hidden"
                />
                <Image
                  src="/branding/SalkLogo-WCB-W.png"
                  alt="Salk Institute"
                  width={16}
                  height={16}
                  className="hidden size-4 object-contain dark:block"
                />
                <span>Salk Institute</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenuPrimitive>
        <SidebarMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
