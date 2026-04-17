import { Header } from '@/app/_components/layout/header'
import { Footer } from '@/app/_components/layout/footer'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/app/_components/layout/app-sidebar'
import { MaintenanceBanner } from '@/components/maintenance-banner'
import { WelcomeDialog } from '@/features/onboarding/components/welcome-dialog'
import { cookies } from 'next/headers'
import { Suspense } from 'react'

async function AppShell({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true'
  const widthCookie = cookieStore.get('sidebar_width')?.value
  const defaultWidth = widthCookie ? Number(widthCookie) : undefined
  const maintenanceMessage = process.env.MAINTENANCE_MESSAGE?.trim()

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
          className="relative h-full w-full flex-1 overflow-auto"
        >
          {children}
        </main>
        <WelcomeDialog />
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
