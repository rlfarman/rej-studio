import '@/styles/globals.css'
import { Header } from '@/app/_components/layout/header'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Footer } from '@/app/_components/layout/footer'
import { ThemeProvider } from '@/app/_components/layout/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/app/_components/layout/app-sidebar'
import { Toaster } from '@/components/ui/sonner'
import { QueryProvider } from '@/app/_components/providers/query-provider'
import { MaintenanceBanner } from '@/components/maintenance-banner'
import { cookies } from 'next/headers'
import { GoogleTagManager } from '@/components/google-tag-manager'
import { AnalyticsPageview } from '@/components/analytics-pageview'
import { AnalyticsProperties } from '@/components/analytics-properties'
import { WebVitals } from '@/components/web-vitals'
import { Suspense } from 'react'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rejstudio.com'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'REJ Studio',
    template: '%s | REJ Studio',
  },
  description:
    'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'REJ Studio',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'REJ Studio',
  },
}

// Reads cookies (runtime data) inside Suspense so the static shell streams
// immediately and the dynamic sidebar state resolves without blocking.
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
      className="relative flex h-full w-full flex-row overflow-hidden"
    >
      <AppSidebar />
      <SidebarInset className="relative flex h-full min-h-screen max-w-full flex-1 flex-col overflow-hidden">
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
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head />
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <a
              href="#main-content"
              className="focus:bg-background focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-md focus:ring-2"
            >
              Skip to content
            </a>
            <Suspense>
              <AppShell>{children}</AppShell>
            </Suspense>
            <Toaster />
            <Suspense fallback={null}>
              <AnalyticsPageview />
            </Suspense>
            <AnalyticsProperties />
          </QueryProvider>
        </ThemeProvider>
        <WebVitals />
        <GoogleTagManager />
      </body>
    </html>
  )
}
