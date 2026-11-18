import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react'

import {
  isToasterWanted,
  loadToaster,
  subscribeToasterWanted,
  toasterMounted,
} from '@/lib/toast'

const Toaster = lazy(() =>
  import('@/components/ui/sonner').then((module) => ({
    default: module.Toaster,
  })),
)

/** Runs after the Toaster's own effects, i.e. once it has subscribed. */
function Mounted() {
  useEffect(() => toasterMounted(), [])
  return null
}

/**
 * The toast container, mounted on the first toast or once the page is idle
 * (src/lib/toast.ts). Never in the prerendered HTML, so hydration agrees.
 */
export function LazyToaster() {
  const wanted = useSyncExternalStore(
    subscribeToasterWanted,
    isToasterWanted,
    () => false,
  )

  useEffect(() => {
    const preload = () => void loadToaster()
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(preload, { timeout: 5_000 })
      return () => cancelIdleCallback(handle)
    }
    const handle = setTimeout(preload, 1_000)
    return () => clearTimeout(handle)
  }, [])

  if (!wanted) return null
  return (
    <Suspense fallback={null}>
      <Toaster />
      <Mounted />
    </Suspense>
  )
}
