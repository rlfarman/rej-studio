import { fetchCloudDesign } from '@/features/design-tool/api/cloud-designs'
import { designToolCopy } from '@/features/design-tool/copy'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'
import type { CloudDesign } from '@/features/design-tool/types/cloud-design'
import { createCloudPoller } from '@/features/design-tool/utils/cloud-poller'
import {
  notifyRunSettled,
  requestOpenJob,
} from '@/features/design-tool/utils/finish-notification'

/**
 * The page's one cloud poller, over the design history: it polls the
 * history's running cloud entries and writes each answer back into its entry,
 * so the result is kept in this browser from then on and the 30-day cloud
 * retention only matters to a device that never opened it.
 *
 * Started by CloudRuns in the app shell once history has loaded; woken when
 * the tab regains focus and when a design is submitted.
 */

const runCopy = designToolCopy.browserRun

/** Writes what the cloud says about a design into its history entry. */
export function applyCloudDesign(design: CloudDesign) {
  const { upsertEntry, getEntry } = useJobHistory.getState()
  const existing = getEntry(design.id)
  const formValues = existing?.formValues ?? design.values
  switch (design.status) {
    case 'completed':
      if (!design.result) return
      upsertEntry({
        id: design.id,
        status: 'completed',
        result: design.result,
        formValues,
        cloudId: design.id,
      })
      return
    case 'failed':
      upsertEntry({
        id: design.id,
        status: 'failed',
        error: design.error ?? {
          code: 'unknown',
          message: designToolCopy.jobErrors.unknown,
          retriable: true,
        },
        formValues,
        cloudId: design.id,
      })
      return
    default:
      // Queued or running. A completed copy here (from an earlier poll, or a
      // previous run of the same design) stays as it is.
      if (existing?.status === 'completed') return
      upsertEntry({
        id: design.id,
        status: 'running',
        formValues,
        cloudId: design.id,
      })
  }
}

const poller = createCloudPoller({
  runningIds: () =>
    useJobHistory
      .getState()
      .entries.filter((e) => e.status === 'running' && e.cloudId)
      .map((e) => e.id),
  fetchDesign: fetchCloudDesign,
  onSettled: (id, outcome) => {
    if (!outcome.found) {
      useJobHistory.getState().upsertEntry({
        id,
        status: 'failed',
        error: {
          code: 'not_found',
          message: designToolCopy.cloud.notFound,
          retriable: true,
        },
      })
      return
    }
    applyCloudDesign(outcome.design)
    const name = outcome.design.name ?? outcome.design.values?.name ?? ''
    notifyRunSettled({
      id,
      title:
        outcome.design.status === 'completed'
          ? runCopy.completedTitle
          : runCopy.failedTitle,
      body:
        outcome.design.status === 'completed'
          ? runCopy.completedBody(name)
          : runCopy.failedBody(name, outcome.design.error?.message ?? ''),
      onOpen: () => requestOpenJob(id),
    })
  },
})

export const cloudRuns = {
  start: poller.start,
  wake: poller.wake,
  stop: poller.stop,
}
