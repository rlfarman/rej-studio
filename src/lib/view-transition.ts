// Thin wrapper around the View Transitions API. Falls through to a direct
// call when the browser doesn't support it, the user prefers reduced motion,
// or a transition is already in flight (starting a second transition while
// one is running aborts the first, leaving the page in an invalid state).
// Pair this only with user-action state changes, not reactive effects —
// effects can double-fire under StrictMode and wreck the transition.

type ViewTransitionSupport = {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>
  }
}

// Simple in-flight guard. The View Transitions spec doesn't expose an "is a
// transition running?" accessor, so we track it ourselves.
let inFlight = false

function supportsViewTransition(): boolean {
  if (typeof document === 'undefined') return false
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return false
  }
  return (
    typeof (document as unknown as ViewTransitionSupport)
      .startViewTransition === 'function'
  )
}

/**
 * Run `cb` inside a browser View Transition if supported. Returns a Promise
 * that resolves when the transition finishes (or immediately on fallback).
 * Callers typically don't need to await.
 */
export function startViewTransition(
  cb: () => void | Promise<void>,
): Promise<void> {
  if (!supportsViewTransition() || inFlight) {
    return Promise.resolve(cb()).then(() => undefined)
  }
  inFlight = true
  try {
    const doc = document as unknown as ViewTransitionSupport
    const handle = doc.startViewTransition!(cb)
    return handle.finished
      .catch(() => undefined)
      .finally(() => {
        inFlight = false
      })
  } catch {
    inFlight = false
    return Promise.resolve(cb()).then(() => undefined)
  }
}
