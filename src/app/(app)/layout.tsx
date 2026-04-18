import { Suspense } from 'react'
import { Header } from '@/app/_components/layout/header'
import { Footer } from '@/app/_components/layout/footer'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/app/_components/layout/app-sidebar'
import { MaintenanceBanner } from '@/components/maintenance-banner'
import { WelcomeDialog } from '@/features/onboarding/components/welcome-dialog'
import { HelpButton } from '@/features/onboarding/components/help-button'

// Reading process.env.MAINTENANCE_MESSAGE at runtime forces dynamic
// rendering under `cacheComponents`; isolate it in its own async component
// so the rest of the layout stays static and streams immediately.
async function MaintenanceBannerSlot() {
  'use cache'
  const message = process.env.MAINTENANCE_MESSAGE?.trim()
  if (!message) return null
  return <MaintenanceBanner message={message} signature={message} />
}

// Sidebar state persists in localStorage; an inline script in the root
// layout (src/app/layout.tsx) applies it to <html> before hydration so this
// layout stays fully static — no cookies(), no per-request dynamic SSR.
// Children are wrapped in Suspense so pages that read dynamic APIs
// (params/searchParams) can stream without blocking the shell.
export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider className="relative h-svh min-h-0 w-full flex-row overflow-hidden">
      <AppSidebar />
      <SidebarInset className="relative flex h-svh min-h-0 max-w-full flex-1 flex-col overflow-hidden">
        <Suspense fallback={null}>
          <MaintenanceBannerSlot />
        </Suspense>
        <Header />
        <main
          id="main-content"
          className="relative flex h-full w-full flex-1 flex-col overflow-auto"
        >
          <div className="flex-1">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
          <Footer />
        </main>
        <WelcomeDialog />
        <HelpButton />
      </SidebarInset>
    </SidebarProvider>
  )
}
