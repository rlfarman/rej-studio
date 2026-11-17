import { useLocation } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * The current pathname, or null in the prerendered SPA shell and while the
 * browser hydrates it.
 *
 * The build prerenders one shell for every URL, so anything that depends on
 * the path (the active nav link, the header's page label) must render
 * neutrally there, and hydration must reproduce that same neutral markup or
 * React throws the tree away. `useSyncExternalStore` gives exactly that:
 * the server snapshot (false) during the shell render and hydration, the
 * client one (true) right after.
 */
export function useShellPathname(): string | null {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const pathname = useLocation({ select: (location) => location.pathname })
  return hydrated ? pathname : null
}
