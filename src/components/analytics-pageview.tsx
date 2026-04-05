'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

/**
 * Fires a `virtual_pageview` event on every client-side navigation. The
 * initial page load is handled by GTM's built-in Page View trigger, so we
 * skip the first render.
 *
 * Must be wrapped in `<Suspense>` because `useSearchParams()` triggers a
 * Suspense boundary in the App Router.
 */
export function AnalyticsPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    trackEvent({
      event: 'virtual_pageview',
      page_path: pathname,
      page_search: searchParams.toString(),
    })
  }, [pathname, searchParams])

  return null
}
