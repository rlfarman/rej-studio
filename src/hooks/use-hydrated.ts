import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * False during a prerendered render and while the browser hydrates it, true
 * from the commit after.
 *
 * The build prerenders the shell for every URL and some pages in full, so
 * anything that depends on the visitor — the path, who is signed in — must
 * render neutrally there, and the browser's *first* render must reproduce
 * that same neutral markup or React throws the tree away. It is not enough
 * for the data to merely be unresolved at first: a fetch that lands before
 * React gets around to hydrating would otherwise render the real state into
 * markup prerendered without it, which is a mismatch that only shows up
 * under load. `useSyncExternalStore` closes that race by construction — the
 * server snapshot is used for the hydrating render, whenever it happens.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}
