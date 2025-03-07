import '@/styles/globals.css'
import { Header } from '@/components/header'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Footer } from '@/components/footer'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './_components/app-sidebar'

export const metadata = {
  title: 'RNA End-joining Design Tool',
  description: 'RNA End-joining made easy',
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
      <body className="mx-auto flex min-h-screen flex-col justify-between">
        <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <Header />
              <div className="relative flex min-h-screen flex-col pb-6">
                <div className="flex">
                  <main className="flex-1">{children}</main>
                </div>
                <Footer />
              </div>
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
