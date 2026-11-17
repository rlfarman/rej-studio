import { createRouter } from '@tanstack/react-router'

import { PageLoading } from '@/routes/-components/layout/page-loading'
import { RouteError } from '@/routes/-components/route-error'
import { routeTree } from './routeTree.gen'

// Start calls this once per request on the server and once in the browser,
// so it must return a fresh router each time.
export function getRouter() {
  return createRouter({
    routeTree,
    // The page slot's fallback. In SPA mode the prerendered shell renders it
    // where a page would go, so the sidebar and header paint before the
    // client takes over.
    defaultPendingComponent: PageLoading,
    // A page that throws keeps the sidebar and header; the root route has
    // its own standalone boundary for when the layout itself fails.
    defaultErrorComponent: RouteError,
    scrollRestoration: true,
    // Pages scroll inside the shell's <main>, not the window.
    scrollToTopSelectors: ['#main-content'],
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
