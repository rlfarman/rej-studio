'use client'

import { useEffect } from 'react'
import { trackEvent, type AnalyticsEvent } from '@/lib/analytics'

/**
 * Fires a single analytics event on mount. Use in Server Component trees
 * where you can't call `trackEvent` directly.
 */
export function TrackOnMount({ event }: { event: AnalyticsEvent }) {
  useEffect(() => {
    trackEvent(event)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount
  }, [])

  return null
}
