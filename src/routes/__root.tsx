import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

import { MaintenanceBanner } from '@/components/maintenance-banner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { LazyToaster } from '@/components/lazy-toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { appCopy } from '@/copy/app'
import { AppSidebar } from './-components/layout/app-sidebar'
import { Header } from './-components/layout/header'
import { RouteAnnouncer } from './-components/layout/route-announcer'
import { NotFoundPage } from './-components/not-found-page'
import { RouteError } from './-components/route-error'
import { useDocumentTitle } from './-components/layout/use-document-title'
import { useShellPathname } from './-components/layout/use-shell-pathname'
import globalsCss from '@/styles/globals.css?url'
// The three families' Latin subsets, imported for their hashed URLs so the
// document can ask for them in `links` below. Vite emits one copy per file:
// these are the same assets the stylesheet's @font-face rules point at.
import sourceSansLatin from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url'
import sourceSerifLatin from '@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2?url'
import sourceMonoLatin from '@fontsource-variable/source-code-pro/files/source-code-pro-latin-wght-normal.woff2?url'
import { geneDataUrl } from '@/features/gene-search/corpus/gene-data-url'

/**
 * The gene data's origin when it is not this site's (the R2 custom domain).
 * Opening that connection while the page loads takes its DNS lookup and TLS
 * handshake (often 100–300 ms on a phone) off the first search or gene page.
 * `crossorigin`: the data is fetched with CORS and no credentials, which
 * uses a connection of its own.
 */
const geneDataOrigin = (() => {
  const url = geneDataUrl()
  return /^https?:\/\//.test(url) ? new URL(url).origin : null
})()

// Reads the user's sidebar preferences from localStorage and applies them to
// <html> before React renders, so the prerendered shell opens the sidebar
// at the saved state and width without a flash. Same pattern next-themes
// uses for dark mode. src/components/ui/sidebar.tsx reads the attributes.
const SIDEBAR_PRELOAD_SCRIPT = `(function(){try{var d=document.documentElement;var s=localStorage.getItem('rej-sidebar-state');if(s==='true'||s==='false')d.dataset.sidebarPreloadOpen=s;var w=localStorage.getItem('rej-sidebar-width');if(w&&/^\\d+$/.test(w)){var n=parseInt(w,10);if(n>=200&&n<=480){d.dataset.sidebarPreloadWidth=String(n);d.style.setProperty('--sidebar-width',n+'px');}}}catch(e){}})();`

// The login page is served the same prerendered shell as every route, with
// the sidebar and header in it. Marking <html> before the first paint lets
// globals.css hide that chrome until the client renders the form alone.
const LOGIN_PRELOAD_SCRIPT = `(function(){if(location.pathname==='/login')document.documentElement.dataset.loginPage='';})();`

// Build-time, like every Vite env var: set it and rebuild to show a banner.
const maintenanceMessage = import.meta.env.VITE_MAINTENANCE_MESSAGE?.trim()

// Route loaders read through the router's query client (src/router.tsx).
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
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
        // The fonts are declared inside that stylesheet, so without this the
        // browser only learns they exist after fetching and parsing it: it
        // paints in a fallback, then reflows every line when they arrive.
        // That was 0.33 of 0.467 CLS on the design tool, which Lighthouse
        // scored 0.19. Asking for them here starts them with the stylesheet
        // instead, and the swap lands before the first paint.
        //
        // Only the Latin subsets, and only the upright weights: they are
        // what every page renders. The other subsets stay lazy, which is the
        // point of @font-face carrying a unicode-range.
        ...[sourceSansLatin, sourceSerifLatin, sourceMonoLatin].map((href) => ({
          rel: 'preload',
          href,
          as: 'font',
          type: 'font/woff2',
          // Fonts are fetched in CORS mode whatever the origin, so a
          // preload without this is a second, unused request.
          crossOrigin: 'anonymous' as const,
        })),
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        ...(geneDataOrigin
          ? [
              {
                rel: 'preconnect',
                href: geneDataOrigin,
                crossOrigin: 'anonymous' as const,
              },
            ]
          : []),
      ],
    }),
    shellComponent: RootDocument,
    component: AppLayout,
    errorComponent: RootError,
    notFoundComponent: RootNotFound,
  },
)

/** The document: always prerendered, around the layout or a boundary. */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the theme class on <html> before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_PRELOAD_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LOGIN_PRELOAD_SCRIPT }} />
        {/* Phone browsers tint their toolbar with this: the --background
            tokens in globals.css. It follows the system's scheme, not a
            theme picked in the app. Written here, not in head(): HeadContent
            keeps one meta per name, and this needs one per scheme. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#f5f7fa"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#0d0f15"
        />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-2xl focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-ring"
          >
            {appCopy.skipToContent}
          </a>
          {children}
          <LazyToaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

/**
 * Sidebar, header and the page. The login page stands alone: once hydrated
 * (the shell is the same for every URL, so hydration must reproduce it),
 * and hidden by LOGIN_PRELOAD_SCRIPT until then.
 */
function AppLayout() {
  if (useShellPathname() === '/login') return <Outlet />
  return (
    // Tooltips only appear inside the app shell; providing them here keeps
    // Base UI's tooltip out of the error and not-found pages.
    <TooltipProvider>
      <SidebarProvider
        data-app-chrome=""
        className="relative h-svh min-h-0 w-full flex-row overflow-hidden"
      >
        <AppSidebar />
        <SidebarInset className="relative flex h-svh min-h-0 max-w-full flex-1 flex-col overflow-hidden">
          <RouteAnnouncer />
          {maintenanceMessage && (
            <MaintenanceBanner
              message={maintenanceMessage}
              signature={maintenanceMessage}
            />
          )}
          <Header />
          <main
            id="main-content"
            // Focusable only programmatically: the skip link and
            // RouteAnnouncer both move the keyboard here.
            tabIndex={-1}
            className="relative flex h-full w-full flex-1 flex-col overflow-auto outline-none"
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
 * A `notFound()` thrown by a loader whose route has no not-found component
 * of its own. Unmatched URLs never get here: the catch-all route (`$.tsx`)
 * matches them. This runs after the route has set its title, so it says what
 * the page is itself.
 */
function RootNotFound() {
  useDocumentTitle(appCopy.metadata.title(appCopy.notFound.pageTitle))
  return <NotFoundPage />
}
