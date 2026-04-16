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
import { Home, BookOpen, WandSparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { appCopy } from '@/lib/copy'

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
            <SidebarMenuButton asChild size="lg" tooltip={appCopy.siteName}>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center">
                  <Dna className="size-5" />
                </div>
                <div className="grid flex-1 text-left leading-tight opacity-0 transition-opacity duration-150 group-data-[state=expanded]:opacity-100 group-data-[state=expanded]:delay-200 [[data-mobile=true]_&]:opacity-100">
                  <span className="truncate font-mono text-sm font-semibold">
                    {appCopy.siteName}
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
                tooltip={appCopy.nav.home}
              >
                <Link href="/">
                  <Home />
                  <span>{appCopy.nav.home}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/design-tool')}
                tooltip={appCopy.nav.designTool}
              >
                <Link href="/design-tool">
                  <WandSparkles />
                  <span>{appCopy.nav.designTool}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/docs')}
                tooltip={appCopy.nav.documentation}
              >
                <Link href="/docs">
                  <BookOpen />
                  <span>{appCopy.nav.documentation}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenuPrimitive>
        </SidebarGroup>
        <div className="min-w-0 opacity-0 transition-opacity duration-150 group-data-[collapsible=icon]:max-h-0 group-data-[collapsible=icon]:overflow-hidden group-data-[state=expanded]:opacity-100 group-data-[state=expanded]:delay-200 [[data-mobile=true]_&]:max-h-none [[data-mobile=true]_&]:opacity-100">
          <FavoriteGenes />
          <RecentGenes />
          <RecentJobs onSelectJob={handleSelectJob} />
        </div>
      </SidebarContent>
      <JobWatcher />
      <SidebarFooter>
        <SidebarMenuPrimitive>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={appCopy.nav.salkInstitute}>
              <a
                href="https://www.salk.edu"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/branding/SalkLogo-WCB-K.png"
                  alt={appCopy.nav.salkImageAlt}
                  width={16}
                  height={16}
                  className="block dark:hidden"
                />
                <Image
                  src="/branding/SalkLogo-WCB-W.png"
                  alt={appCopy.nav.salkImageAlt}
                  width={16}
                  height={16}
                  className="hidden dark:block"
                />
                <span>{appCopy.nav.salkInstitute}</span>
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
