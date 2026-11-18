import { useSyncExternalStore } from 'react'

function hasMatchMedia() {
  return (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  )
}

/**
 * Whether a CSS media query matches, kept current as it changes.
 *
 * For leaving out UI that CSS would hide anyway, where mounting it has a
 * cost (a control per table row, say). False on the server and wherever
 * `matchMedia` is missing, so callers should treat `true` as the extra.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    if (!hasMatchMedia()) return () => {}
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }
  return useSyncExternalStore(
    subscribe,
    () => hasMatchMedia() && window.matchMedia(query).matches,
    () => false,
  )
}
