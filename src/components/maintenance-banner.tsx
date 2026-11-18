import { useSyncExternalStore, useState } from 'react'
import { X, TriangleAlert } from 'lucide-react'
import { appCopy } from '@/copy/app'
import { cn } from '@/lib/utils'

type Props = {
  message: string
  /** Value that changes when the banner content changes, used to reset dismissal. */
  signature: string
}

const STORAGE_KEY = 'rej-maintenance-banner-dismissed'

const noopSubscribe = () => () => {}

/**
 * Whether this exact notice was dismissed before. Storage can be blocked
 * (private mode, a locked-down lab browser), and this runs during render in
 * the app shell: an exception here replaces the whole app with the root
 * error page, which would happen precisely while maintenance is announced.
 * A blocked read means "not dismissed" — showing the notice again is the
 * harmless side.
 */
function readDismissed(signature: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === signature
  } catch {
    return false
  }
}

function useIsDismissed(signature: string) {
  // Subscribe is a no-op — we only need the snapshot, not real-time updates.
  // Dismissal happens via the button click which triggers a re-render anyway.
  return useSyncExternalStore(
    noopSubscribe,
    () => readDismissed(signature),
    () => true, // Prerender: assume dismissed to avoid a flash.
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
        'flex items-start gap-3 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-warning-soft md:px-6',
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, signature)
          } catch {
            // Blocked storage: the notice stays dismissed for this page only.
          }
          setDismissed(true)
        }}
        className="-m-1 rounded-full p-1 transition-colors hover:bg-warning/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={appCopy.maintenance.dismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
