import { Activity, Dna, Home, WandSparkles } from 'lucide-react'
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
  useSidebar,
} from '@/components/ui/sidebar'
import { FavoriteGenes } from '@/features/gene-search/components/favorites-panel'
import { RecentGenes } from '@/features/gene-search/components/recent-genes-panel'
import { RecentJobs } from '@/features/design-tool/components/recent-jobs-panel'
import { JobWatcher } from '@/features/design-tool/components/job-watcher'
import { BrowserRuns } from '@/features/design-tool/components/browser-runs'
import { SalkLogo } from './salk-logo'
import { SidebarMenu } from './sidebar-menu'
import {
  useJobHistory,
  useJobHistoryHydrated,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import { Link, useNavigate } from '@tanstack/react-router'
import { useShellPathname } from './use-shell-pathname'
import { useEffect, useSyncExternalStore } from 'react'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

const noopSubscribe = () => () => {}

const NAV_ITEMS = [
  {
    href: '/',
    label: appCopy.sidebar.nav.home,
    icon: Home,
    isActive: (pathname: string) => pathname === '/',
  },
  {
    href: '/design-tool',
    label: appCopy.sidebar.nav.designTool,
    icon: WandSparkles,
    isActive: (pathname: string) => pathname.startsWith('/design-tool'),
  },
  {
    href: '/disease-associations',
    label: appCopy.sidebar.nav.diseaseAssociations,
    icon: Activity,
    isActive: (pathname: string) =>
      pathname.startsWith('/disease-associations'),
  },
] as const

/**
 * Primary nav links. `pathname` is null in the prerendered SPA shell, where
 * the URL isn't known, so the links render without an active state there.
 */
function NavLinks() {
  const pathname = useShellPathname()
  return (
    <SidebarMenuPrimitive>
      {NAV_ITEMS.map(({ href, label, icon: Icon, isActive }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            isActive={pathname !== null && isActive(pathname)}
            tooltip={label}
            render={<Link to={href} />}
          >
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenuPrimitive>
  )
}

/**
 * Closes the mobile sidebar sheet after any navigation (nav links,
 * favorites, recent genes, jobs, the search palette). Lives outside the
 * sheet: the sheet's content unmounts while it's closed, and an effect in
 * there would also fire when the sheet opens and close it again.
 */
function CloseMobileSidebarOnNavigate() {
  const pathname = useShellPathname()
  const { setOpenMobile } = useSidebar()
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])
  return null
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const favoriteCount = useFavoriteGenes((s) => s.favoriteGenes.length)
  const recentCount = useRecentGenes((s) => s.recentGenes.length)
  const jobCount = useJobHistory((s) => s.entries.length)
  // History lives in the browser, so the server always renders it empty.
  // Only decide "nothing here yet" after hydration, or the hint would flash
  // (and mismatch) for anyone with saved history. Favorites and recents are
  // in localStorage and ready on mount; design history loads from IndexedDB
  // a moment later, so it gets its own signal.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const jobsHydrated = useJobHistoryHydrated()
  const hydrated = mounted && jobsHydrated
  const hasHistory = favoriteCount + recentCount + jobCount > 0

  function handleSelectJob(entry: JobHistoryEntry) {
    void navigate({ to: '/design-tool', search: { job: entry.id } })
  }

  return (
    <>
      <CloseMobileSidebarOnNavigate />
      {/* Outside <Sidebar>: on phones the sidebar is a sheet whose content
          unmounts while closed, which stopped running jobs from polling. */}
      <JobWatcher />
      <BrowserRuns />
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <SidebarMenuPrimitive>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip={commonCopy.brandName}
                render={<Link to="/" />}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-spark text-spark-foreground">
                  <Dna className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight opacity-0 transition-opacity duration-150 group-data-[state=expanded]:opacity-100 group-data-[state=expanded]:delay-200 [[data-mobile=true]_&]:opacity-100">
                  <span className="truncate font-display text-base font-semibold">
                    {commonCopy.brandName}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenuPrimitive>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="shrink-0">
            <NavLinks />
          </SidebarGroup>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto opacity-0 transition-opacity duration-150 group-data-[collapsible=icon]:max-h-0 group-data-[collapsible=icon]:overflow-hidden group-data-[state=expanded]:opacity-100 group-data-[state=expanded]:delay-200 [[data-mobile=true]_&]:max-h-none [[data-mobile=true]_&]:opacity-100">
            {/* Each history section renders only when it has items; one quiet
                line stands in for all three when everything is empty. */}
            <FavoriteGenes />
            <RecentGenes />
            {jobCount > 0 && <RecentJobs onSelectJob={handleSelectJob} />}
            {hydrated && !hasHistory && (
              <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {appCopy.sidebar.historyHint}
              </p>
            )}
          </div>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenuPrimitive>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={appCopy.sidebar.lab}
                render={
                  <a
                    href="https://pfaff.salk.edu/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SalkLogo alt={appCopy.sidebar.salkLogoAlt} />
                    <span>{appCopy.sidebar.lab}</span>
                  </a>
                }
              />
            </SidebarMenuItem>
          </SidebarMenuPrimitive>
          <SidebarMenu />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  )
}
