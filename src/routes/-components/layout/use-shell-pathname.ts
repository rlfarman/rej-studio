import { useLocation } from '@tanstack/react-router'

import { useHydrated } from '@/hooks/use-hydrated'

/**
 * The current pathname, or null in the prerendered SPA shell and while the
 * browser hydrates it.
 *
 * The build prerenders one shell for every URL, so anything that depends on
 * the path (the active nav link, the header's page label) must render
 * neutrally there, and hydration must reproduce that same neutral markup or
 * React throws the tree away.
 */
export function useShellPathname(): string | null {
  const hydrated = useHydrated()
  const pathname = useLocation({ select: (location) => location.pathname })
  return hydrated ? pathname : null
}
