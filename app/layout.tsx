import '@/styles/globals.css'
import { Header } from '@/components/header'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Footer } from '@/components/footer'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { Toaster } from '@/components/ui/sonner'
import { FavoriteGenesProvider } from '@/context/favorite-genes-context'
import { RecentGenesProvider } from '@/context/recent-genes-context'
import { SpeciesProvider } from '@/context/species-context'
import { SearchHistoryProvider } from '@/context/search-history-context'
import { cookies } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'REJ Studio',
  description: 'RNA End-joining made easy',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true'

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head />
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <FavoriteGenesProvider>
            <RecentGenesProvider>
              <SearchHistoryProvider>
              <SpeciesProvider>
                <a
                  href="#main-content"
                  className="focus:bg-background focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-md focus:ring-2"
                >
                  Skip to content
                </a>
                <SidebarProvider
                  defaultOpen={defaultOpen}
                  className="relative flex h-full w-full flex-row overflow-hidden"
                >
                  <AppSidebar />
                  <SidebarInset className="relative flex h-full min-h-screen max-w-full flex-1 flex-col overflow-hidden">
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
                <Toaster />
              </SpeciesProvider>
              </SearchHistoryProvider>
            </RecentGenesProvider>
          </FavoriteGenesProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
