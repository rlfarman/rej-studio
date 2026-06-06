import { Suspense } from 'react'
import { Header } from '@/app/_components/layout/header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/app/_components/layout/app-sidebar'
import { MaintenanceBanner } from '@/components/maintenance-banner'
import { WelcomeDialog } from '@/features/onboarding/components/welcome-dialog'
import { HelpButton } from '@/features/onboarding/components/help-button'
import { GuidedTourRunner } from '@/features/onboarding/components/guided-tour-runner'
import { TourRingOverlay } from '@/features/onboarding/components/tour-ring-overlay'

// Sidebar state persists in localStorage; an inline script in the root
// layout (src/app/layout.tsx) applies it to <html> before hydration, so
// the layout no longer needs `cookies()` to SSR the correct initial state.
//
// The shell still streams under one Suspense boundary because `AppSidebar`,
// `Header`, and `WelcomeDialog` all call `usePathname()`, and under Next 16
// `cacheComponents` any request-time data (including dynamic route params
// reached by child pages) must live below a Suspense boundary. Matching
// the pre-refactor structure keeps it predictable — Next prerenders the
// static HTML frame (html/body/theme/query providers) and streams the
// interactive shell at request time.
function AppShell({
  children,
  maintenanceMessage,
}: {
  children: React.ReactNode
  maintenanceMessage: string | undefined
}) {
  return (
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
          <div className="flex-1">{children}</div>
        </main>
        <WelcomeDialog />
        <HelpButton />
        <GuidedTourRunner />
        <TourRingOverlay />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const maintenanceMessage = process.env.MAINTENANCE_MESSAGE?.trim()

  return (
    <Suspense fallback={null}>
      <AppShell maintenanceMessage={maintenanceMessage}>{children}</AppShell>
    </Suspense>
  )
}
