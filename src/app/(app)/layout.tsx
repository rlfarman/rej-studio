import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { Header } from '@/app/_components/layout/header'
import { Footer } from '@/app/_components/layout/footer'
import {
  SidebarInset,
  SidebarProvider,
  SIDEBAR_COOKIE_OPEN,
  SIDEBAR_COOKIE_WIDTH,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/app/_components/layout/app-sidebar'
import { MaintenanceBanner } from '@/components/maintenance-banner'
import { WelcomeDialog } from '@/features/onboarding/components/welcome-dialog'
import { HelpButton } from '@/features/onboarding/components/help-button'
import { GuidedTourRunner } from '@/features/onboarding/components/guided-tour-runner'
import { TourRingOverlay } from '@/features/onboarding/components/tour-ring-overlay'

const SIDEBAR_WIDTH_DEFAULT = 256
const SIDEBAR_WIDTH_MIN = 200
const SIDEBAR_WIDTH_MAX = 480

// Sidebar preferences live in cookies so the server can render with the
// correct open/width on first paint — no flash, no hydration mismatch, no
// preload script. This is the shadcn sidebar pattern.
//
// The shell streams under a Suspense boundary because `AppSidebar`,
// `Header`, and `WelcomeDialog` all call `usePathname()`. Under Next 16
// `cacheComponents`, request-time data must live below a Suspense boundary.
async function AppShell({
  children,
  maintenanceMessage,
}: {
  children: React.ReactNode
  maintenanceMessage: string | undefined
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_OPEN)?.value !== 'false'
  const widthCookie = cookieStore.get(SIDEBAR_COOKIE_WIDTH)?.value
  const widthNum = widthCookie ? Number(widthCookie) : NaN
  const defaultWidth = Number.isFinite(widthNum)
    ? Math.round(
        Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, widthNum)),
      )
    : SIDEBAR_WIDTH_DEFAULT

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      defaultWidth={defaultWidth}
      className="relative h-svh min-h-0 w-full flex-row overflow-hidden"
    >
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
          <Footer />
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
