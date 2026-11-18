import { useEffect } from 'react'

import { useJobHistoryHydrated } from '@/features/design-tool/hooks/use-job-history'
import { cloudRuns } from '@/features/design-tool/utils/cloud-runs'

/**
 * App-wide upkeep for designs running in the cloud, mounted once in the app
 * shell beside BrowserRuns: once history has loaded, polls the running cloud
 * entries (with backoff, utils/cloud-poller.ts), and polls again at once when
 * the tab comes back into view — which is when the person is looking.
 */
export function CloudRuns() {
  const hydrated = useJobHistoryHydrated()

  useEffect(() => {
    if (!hydrated) return
    cloudRuns.start()
    const onVisible = () => {
      if (document.visibilityState === 'visible') cloudRuns.wake()
    }
    window.addEventListener('focus', cloudRuns.wake)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', cloudRuns.wake)
      document.removeEventListener('visibilitychange', onVisible)
      cloudRuns.stop()
    }
  }, [hydrated])

  return null
}
