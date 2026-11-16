// Guards for designs that run in this tab's Web Worker. The worker keeps
// running while the tab is in the background but dies with the tab, so a
// run needs (a) a warning before the tab closes and (b) a marker that other
// tabs can check to tell a live run from one whose tab is gone.

const LOCK_PREFIX = 'rej-studio:browser-run:'

let unloadHolds = 0

function warnBeforeUnload(event: BeforeUnloadEvent) {
  // Browsers show their own generic text; both calls are needed across
  // engines to trigger the prompt.
  event.preventDefault()
  event.returnValue = ''
}

/**
 * Asks the browser to confirm before the tab closes or navigates away, until
 * the returned release is called. Reference-counted, so overlapping runs keep
 * the warning until the last settles, and registered only while a run is in
 * flight: a permanent handler would also disable the back/forward cache.
 */
export function guardUnload(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (unloadHolds++ === 0) {
    window.addEventListener('beforeunload', warnBeforeUnload)
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--unloadHolds === 0) {
      window.removeEventListener('beforeunload', warnBeforeUnload)
    }
  }
}

function locks(): LockManager | null {
  if (typeof navigator === 'undefined') return null
  return navigator.locks ?? null
}

/**
 * Holds a Web Lock named for the run until `run` settles. The browser drops
 * it when the tab dies, which is how another tab tells a live run from an
 * abandoned one (see claimAbandonedRun).
 */
export function holdRunLock(id: string, run: Promise<unknown>): void {
  void locks()
    ?.request(LOCK_PREFIX + id, () => run.catch(() => {}))
    .catch(() => {})
}

/**
 * Runs `settle` while holding the run's lock, if no live tab holds it.
 * Resolves to whether `settle` ran. Without Web Locks it never does: a live
 * run in another tab can't be ruled out, and the history's 24-hour sweep
 * eventually clears the entry instead.
 */
export async function claimAbandonedRun(
  id: string,
  settle: () => void,
): Promise<boolean> {
  const manager = locks()
  if (!manager) return false
  try {
    return await manager.request(
      LOCK_PREFIX + id,
      { ifAvailable: true },
      (lock) => {
        if (!lock) return false
        settle()
        return true
      },
    )
  } catch {
    return false
  }
}
