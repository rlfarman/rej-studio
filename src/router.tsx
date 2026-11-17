import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import { PageLoading } from '@/routes/-components/layout/page-loading'
import { RouteError } from '@/routes/-components/route-error'
import { parseSearch, stringifySearch } from '@/routes/-components/search-codec'
import { routeTree } from './routeTree.gen'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

// Start calls this once per request on the server and once in the browser,
// so it must return a fresh router (and query client) each time.
export function getRouter() {
  // One client for the route loaders and the components: loaders fill it
  // with `ensureQueryData`, components read the same entries back.
  const queryClient = makeQueryClient()
  return createRouter({
    routeTree,
    context: { queryClient },
    // Plain query strings (`?q=53`, `?i=a&i=b`) rather than the default
    // JSON values; the routes' zod schemas coerce types.
    parseSearch,
    stringifySearch,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    // Query owns freshness; the router's own preload cache would otherwise
    // serve a loader result for 30 s whatever Query thinks of it.
    defaultPreloadStaleTime: 0,
    // Hovering a link loads its page's data, so the click lands on a page
    // that is already there.
    defaultPreload: 'intent',
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
