'use client'

import { useSyncExternalStore, useState } from 'react'
import { X, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  message: string
  /** Value that changes when the banner content changes, used to reset dismissal. */
  signature: string
}

const STORAGE_KEY = 'rej-maintenance-banner-dismissed'

function useIsDismissed(signature: string) {
  // Subscribe is a no-op — we only need the snapshot, not real-time updates.
  // Dismissal happens via the button click which triggers a re-render anyway.
  return useSyncExternalStore(
    () => () => {},
    () => window.localStorage.getItem(STORAGE_KEY) === signature,
    () => true, // SSR: assume dismissed to avoid flash
  )
}

export function MaintenanceBanner({ message, signature }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const storedDismissed = useIsDismissed(signature)

  if (dismissed || storedDismissed) return null

  return (
    <div
      role="status"
      className={cn(
        'border-warning/40 bg-warning/15 text-warning-soft flex items-start gap-3 border-b px-4 py-2 text-sm md:px-6',
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, signature)
          setDismissed(true)
        }}
        className="focus-visible:ring-ring hover:bg-warning/20 -m-1 rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        aria-label="Dismiss maintenance notice"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
