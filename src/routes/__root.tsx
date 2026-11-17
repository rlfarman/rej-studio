import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

import { MaintenanceBanner } from '@/components/maintenance-banner'
import { StatusPage } from '@/components/status-page'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { AppSidebar } from './-components/layout/app-sidebar'
import { Header } from './-components/layout/header'
import { QueryProvider } from './-components/providers/query-provider'
import { RouteError } from './-components/route-error'
import globalsCss from '@/styles/globals.css?url'

// Reads the user's sidebar preferences from localStorage and applies them to
// <html> before React renders, so the prerendered shell opens the sidebar
// at the saved state and width without a flash. Same pattern next-themes
// uses for dark mode. src/components/ui/sidebar.tsx reads the attributes.
const SIDEBAR_PRELOAD_SCRIPT = `(function(){try{var d=document.documentElement;var s=localStorage.getItem('rej-sidebar-state');if(s==='true'||s==='false')d.dataset.sidebarPreloadOpen=s;var w=localStorage.getItem('rej-sidebar-width');if(w&&/^\\d+$/.test(w)){var n=parseInt(w,10);if(n>=200&&n<=480){d.dataset.sidebarPreloadWidth=String(n);d.style.setProperty('--sidebar-width',n+'px');}}}catch(e){}})();`

// Build-time, like every Vite env var: set it and rebuild to show a banner.
const maintenanceMessage = import.meta.env.VITE_MAINTENANCE_MESSAGE?.trim()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // Pages set their own title; this is the fallback.
      { title: appCopy.metadata.siteName },
      { name: 'description', content: appCopy.metadata.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: appCopy.metadata.siteName },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: appCopy.metadata.siteName,
      },
    ],
    links: [
      { rel: 'stylesheet', href: globalsCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  shellComponent: RootDocument,
  component: AppLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

/** The document: always prerendered, around the layout or a boundary. */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the theme class on <html> before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_PRELOAD_SCRIPT }} />
        <HeadContent />
      </head>
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
              className="focus:bg-background focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-2xl focus:px-4 focus:py-2 focus:shadow-md focus:ring-2"
            >
              {appCopy.skipToContent}
            </a>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

/** Sidebar, header and the page. */
function AppLayout() {
  return (
    // Tooltips only appear inside the app shell; providing them here keeps
    // Base UI's tooltip out of the error and not-found pages.
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
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

/** Last-resort boundary: the layout itself failed, so it stands alone. */
function RootError(props: ErrorComponentProps) {
  return <RouteError {...props} standalone />
}

/**
 * Unmatched URLs. TanStack Router renders the root's not-found component in
 * the page slot, so the sidebar and header stay around it.
 */
function NotFound() {
  const router = useRouter()
  return (
    <StatusPage
      eyebrow={appCopy.notFound.eyebrow}
      title={appCopy.notFound.description}
      description={appCopy.notFound.detail}
      actions={
        <>
          <Button nativeButton={false} render={<Link to="/" />}>
            {commonCopy.actions.goHome}
          </Button>
          <Button variant="outline" onClick={() => router.history.back()}>
            {commonCopy.actions.goBack}
          </Button>
        </>
      }
    />
  )
}
