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
      <body className="flex min-h-screen flex-col">
        <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
          <SidebarProvider>
            <div className="flex flex-1">
              <AppSidebar />
              <div className="flex flex-1 flex-col">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
            </div>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
