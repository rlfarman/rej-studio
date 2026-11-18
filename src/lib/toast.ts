// eslint-disable-next-line no-restricted-imports -- this module is the wrapper the rule points to
import type { toast as sonnerToast } from 'sonner'

/**
 * Toasts, with the toast library (sonner, ~33 KB) out of every page's
 * first download.
 *
 * Call `toast.success(…)` etc. as with sonner. The first call (or the
 * page going idle, whichever is first) loads sonner and mounts the
 * container (`<LazyToaster />` in the root layout); a toast is shown once
 * the container has mounted, because sonner's container shows only toasts
 * created after it subscribes. In practice the idle preload has done this
 * long before anyone needs a toast.
 */

type SonnerToast = typeof sonnerToast
type Kind = 'success' | 'error' | 'info' | 'warning'

let wanted = false
const listeners = new Set<() => void>()
let markMounted: (() => void) | null = null
let ready: Promise<SonnerToast> | null = null

/** Loads sonner and has the root layout mount its container. */
export function loadToaster(): Promise<SonnerToast> {
  ready ??= new Promise<void>((resolve) => {
    markMounted = resolve
    wanted = true
    for (const listener of listeners) listener()
  })
    .then(() => import('sonner'))
    .then((module) => module.toast)
  return ready
}

/** For `<LazyToaster />`: whether to mount the container yet. */
export function subscribeToasterWanted(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const isToasterWanted = () => wanted

/** For `<LazyToaster />`: the container is mounted and subscribed. */
export function toasterMounted() {
  markMounted?.()
}

function show(kind: Kind | null) {
  return (...args: Parameters<SonnerToast>) => {
    void loadToaster().then((sonner) =>
      kind ? sonner[kind](...args) : sonner(...args),
    )
  }
}

export const toast = Object.assign(show(null), {
  success: show('success'),
  error: show('error'),
  info: show('info'),
  warning: show('warning'),
})
