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
import { SpeciesProvider } from './_context/species-context'
import { cookies } from 'next/headers'

export const metadata = {
  title: 'RNA End-joining Design Tool',
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
        <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
          <FavoriteGenesProvider>
            <RecentGenesProvider>
              <SpeciesProvider>
                <SidebarProvider
                  defaultOpen={defaultOpen}
                  className="relative flex h-full w-full flex-row overflow-hidden"
                >
                  <AppSidebar />
                  <SidebarInset className="relative flex h-full min-h-screen max-w-full flex-1 flex-col overflow-hidden">
                    <Header />
                    <div className="relative h-full w-full flex-1 overflow-auto">
                      {children}
                    </div>
                    <Footer />
                  </SidebarInset>
                </SidebarProvider>
                <Toaster />
              </SpeciesProvider>
            </RecentGenesProvider>
          </FavoriteGenesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
