import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  isBrowserJobId,
  useJobHistory,
  useJobHistoryHydrated,
} from '@/features/design-tool/hooks/use-job-history'
import { claimAbandonedRun } from '@/features/design-tool/utils/browser-run-guard'
import { subscribeOpenJob } from '@/features/design-tool/utils/finish-notification'
import { designToolCopy } from '../copy'

const copy = designToolCopy.browserRun

/**
 * Settles browser runs whose tab closed mid-design: they are left `running`
 * in history with no worker behind them. Each is marked failed (retriable),
 * so the job view offers "Run again" from its saved inputs.
 *
 * Offered rather than re-run automatically. Runs are seeded from the request,
 * so a re-run gives the identical design either way, but an automatic one
 * would start a multi-second worker on whatever page was opened next, and a
 * design that crashed its tab (out of memory on a huge input) would crash
 * every load after it.
 *
 * A run still going in another tab holds its Web Lock, so it is skipped.
 * Returns the ids it settled, newest first.
 */
export async function settleInterruptedRuns(): Promise<string[]> {
  const candidates = useJobHistory
    .getState()
    .entries.filter((e) => e.status === 'running' && isBrowserJobId(e.id))
    .map((e) => e.id)

  const settled: string[] = []
  for (const id of candidates) {
    await claimAbandonedRun(id, () => {
      // Another tab may have settled it since the list was read.
      if (useJobHistory.getState().getEntry(id)?.status !== 'running') return
      useJobHistory.getState().upsertEntry({
        id,
        status: 'failed',
        error: { code: 'unknown', message: copy.interrupted, retriable: true },
      })
      settled.push(id)
    })
  }
  return settled
}

// Once per page load. Module-level so React's dev double effect (and a
// remount) shares one pass instead of racing a second.
let pass: Promise<string[]> | null = null
let toastShown = false

/**
 * App-wide upkeep for designs run in this browser, mounted once in the app
 * shell next to JobWatcher: settles runs interrupted by a closed tab, and
 * opens a run when its finish notification is clicked.
 */
export function BrowserRuns() {
  const hydrated = useJobHistoryHydrated()
  const navigate = useNavigate()

  useEffect(
    () =>
      subscribeOpenJob(
        (id) => void navigate({ to: '/design-tool', search: { job: id } }),
      ),
    [navigate],
  )

  useEffect(() => {
    if (!hydrated) return
    let active = true
    pass ??= settleInterruptedRuns()
    void pass.then((ids) => {
      if (!active || toastShown || ids.length === 0) return
      toastShown = true
      toast.warning(copy.interruptedToast(ids.length), {
        action: {
          label: copy.interruptedToastAction,
          onClick: () =>
            void navigate({ to: '/design-tool', search: { job: ids[0] } }),
        },
      })
    })
    return () => {
      active = false
    }
  }, [hydrated, navigate])

  return null
}
