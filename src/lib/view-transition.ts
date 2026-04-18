// Thin wrapper around the View Transitions API that degrades cleanly when
// the browser doesn't support it (Firefox at time of writing) or the user
// prefers reduced motion. Callers can write `withViewTransition(() => setX(y))`
// without a feature check at every call site.

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function withViewTransition(update: () => void): void {
  if (typeof document === 'undefined') {
    update()
    return
  }
  // `startViewTransition` is well-typed on modern TS DOM libs but missing or
  // optional in older ones. Go through `unknown` so this compiles against
  // whichever lib.dom.d.ts the build picks up.
  const start = (
    document as unknown as {
      startViewTransition?: (cb: () => void | Promise<void>) => {
        finished?: Promise<void>
      }
    }
  ).startViewTransition
  if (typeof start !== 'function' || prefersReducedMotion()) {
    update()
    return
  }
  // Swallow the "Transition was aborted because of invalid state" rejection
  // that the browser raises when another transition starts before this one
  // captures (e.g. fast successive state changes during submit). The update
  // itself still runs — only the animation is dropped.
  const transition = start.call(document, update)
  transition?.finished?.catch(() => {})
}
