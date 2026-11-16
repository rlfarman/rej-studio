import { Suspense } from 'react'
import { Header } from '@/app/_components/layout/header'
import { PageLoading } from '@/app/_components/layout/page-loading'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/app/_components/layout/app-sidebar'
import { MaintenanceBanner } from '@/components/maintenance-banner'

// Sidebar state persists in localStorage; an inline script in the root
// layout (src/app/layout.tsx) applies it to <html> before hydration, so
// the layout needs no `cookies()` and the whole shell prerenders.
//
// `AppSidebar` and `Header` read `usePathname()`, which suspends while a
// route with a dynamic param (/genes/[symbol]) prerenders. Each keeps that
// read in its own small Suspense boundary with a same-shaped fallback, so
// the sidebar, header and page frame are in the static shell instead of
// waiting behind one boundary with no fallback. The page slot gets its own
// boundary too, for pages that read request data at their top level.
export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const maintenanceMessage = process.env.MAINTENANCE_MESSAGE?.trim()

  return (
    // Tooltips only appear inside the app shell; providing them here keeps
    // Base UI's tooltip and floating-ui out of the login and error pages.
    <TooltipProvider>
      <SidebarProvider className="relative h-svh min-h-0 w-full flex-row overflow-hidden">
        <AppSidebar />
        <SidebarInset className="relative flex h-svh min-h-0 max-w-full flex-1 flex-col overflow-hidden">
          {maintenanceMessage && (
            <MaintenanceBanner
              message={maintenanceMessage}
              signature={maintenanceMessage}
            />
          )}
          <Header />
          <main
            id="main-content"
            className="relative flex h-full w-full flex-1 flex-col overflow-auto"
          >
            <div className="flex-1">
              <Suspense fallback={<PageLoading />}>{children}</Suspense>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
