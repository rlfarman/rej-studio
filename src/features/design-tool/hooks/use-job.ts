import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  browserOptimizerSupported,
  designInBrowser,
  warmOptimizerWorker,
} from '@/features/design-tool/api/browser-optimizer'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'
import {
  BROWSER_ID_PREFIX,
  useJobHistory,
  useJobHistoryHydrated,
  type JobStatus as EntryStatus,
  type JobError,
} from '@/features/design-tool/hooks/use-job-history'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import {
  guardUnload,
  holdRunLock,
} from '@/features/design-tool/utils/browser-run-guard'
import {
  notifyRunSettled,
  requestOpenJob,
} from '@/features/design-tool/utils/finish-notification'
import { trackEvent } from '@/lib/analytics'
import { designToolCopy } from '@/features/design-tool/copy'

const copy = designToolCopy.jobErrors
const runCopy = designToolCopy.browserRun

type JobStatus = 'idle' | 'submitting' | EntryStatus

interface UseJobOptions {
  // If set, seeds jobId so derived state reads from this design's history
  // entry. Designs run in the browser, so only this browser's history can
  // resolve it: an id it doesn't have reads as no longer available.
  initialJobId?: string | null
  /**
   * Called when a new run replaces the design `initialJobId` named, so the
   * caller can drop it from the URL (without remounting the form mid-run).
   */
  onLeaveJob?: (jobId: string) => void
}

interface UseJobReturn {
  submitJob: (values: FormValues) => Promise<void>
  cancelJob: () => Promise<void>
  jobId: string | null
  status: JobStatus
  result: ProcessResult | null
  error: JobError | null
  formValues: FormValues | null
  progress: number | undefined
  stage: string | undefined
  isLoading: boolean
  /** Whether this browser can run the designer (Web Workers + WebAssembly). */
  runsInBrowser: boolean
  /**
   * True while a resumed job's entry may still be loading from storage
   * (history hydrates asynchronously). Callers should show neither the
   * empty form nor "not found" until it clears.
   */
  isRestoring: boolean
}

/**
 * Whether this browser can run the designer. Checked after mount (the
 * prerendered shell can't know), and the optimizer starts downloading
 * then, while the person is still entering a sequence. A browser without
 * support still gets a run: it fails with a message saying why.
 */
function useBrowserOptimizer(): boolean {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is an external system, only knowable on the client
    setSupported(browserOptimizerSupported())
    warmOptimizerWorker()
  }, [])
  return supported
}

export function useJob({
  initialJobId = null,
  onLeaveJob,
}: UseJobOptions = {}): UseJobReturn {
  const [jobId, setJobIdState] = useState<string | null>(initialJobId)
  const runsInBrowser = useBrowserOptimizer()
  // The in-flight browser run, if any. Cancel aborts it (there is no
  // server-side job to cancel), and a thrown mutation settles its entry.
  const browserRunRef = useRef<{
    id: string
    controller: AbortController
  } | null>(null)
  // Selector-scoped reads so this hook only re-renders when the specific
  // entry it cares about changes.
  const upsertEntry = useJobHistory((s) => s.upsertEntry)
  const entry = useJobHistory(
    (s) => s.entries.find((e) => e.id === jobId) ?? null,
  )
  const progress = useJobHistory((s) => (jobId ? s.progressById[jobId] : null))
  const historyHydrated = useJobHistoryHydrated()
  // The job this hook is showing, for a notification click to tell whether
  // the run is already on screen. Null once the form unmounts.
  const shownJobIdRef = useRef<string | null>(null)
  useEffect(() => {
    shownJobIdRef.current = jobId
    return () => {
      shownJobIdRef.current = null
    }
  }, [jobId])

  const openJob = (id: string) => {
    if (shownJobIdRef.current === id) return
    // The form that ran it is gone (the person navigated away): load the
    // job from history. A browser run's id resolves only on this device,
    // which is where the notification is.
    requestOpenJob(id)
  }

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const params = buildJobParams(values)

      // The design runs here, so there is no job to poll. A local id carries
      // progress and the finished result through the run's history entry.
      // It is never written to the URL: it resolves only in this browser.
      const id = `${BROWSER_ID_PREFIX}${crypto.randomUUID()}`
      const controller = new AbortController()
      browserRunRef.current = { id, controller }

      upsertEntry({ id, status: 'running', formValues: values })
      useJobHistory
        .getState()
        .setProgress(id, { progress: 0.02, stage: 'Starting' })
      setJobIdState(id)

      const run = designInBrowser(params, {
        signal: controller.signal,
        onProgress: (progress, stage) =>
          useJobHistory.getState().setProgress(id, { progress, stage }),
      })
      // The worker dies with the tab: warn before it closes, and hold a lock
      // that tells other tabs this run is alive (BrowserRunRecovery).
      const releaseUnload = guardUnload()
      holdRunLock(id, run)
      try {
        return { outcome: await run, values, id }
      } catch (err) {
        // A thrown run (a bug, not an expected failure) still settles its
        // entry, or it would read as running until the next load.
        upsertEntry({
          id,
          status: 'failed',
          error: { code: 'unknown', message: copy.unknown, retriable: true },
        })
        notifyRunSettled({
          id,
          title: runCopy.failedTitle,
          body: runCopy.failedBody(values.name, copy.unknown),
          onOpen: () => openJob(id),
        })
        throw err
      } finally {
        releaseUnload()
        browserRunRef.current = null
      }
    },
    onMutate: () => {
      setJobIdState(null)
      if (initialJobId) onLeaveJob?.(initialJobId)
    },
    // The run's history entry was created when the design started, so
    // progress had somewhere to go; settle that one in place.
    onSuccess: ({ outcome, values, id }) => {
      if (outcome.ok) {
        upsertEntry({
          id,
          status: 'completed',
          result: outcome.data,
          formValues: values,
        })
        trackEvent({ event: 'job_submit', job_id: id })
        notifyRunSettled({
          id,
          title: runCopy.completedTitle,
          body: runCopy.completedBody(values.name),
          onOpen: () => openJob(id),
        })
        return
      }
      const cancelled = outcome.error.code === 'cancelled'
      upsertEntry({
        id,
        status: cancelled ? 'cancelled' : 'failed',
        error: outcome.error,
        formValues: values,
      })
      if (!cancelled) {
        trackEvent({
          event: 'job_failed',
          job_id: id,
          error_code: outcome.error.code,
        })
        notifyRunSettled({
          id,
          title: runCopy.failedTitle,
          body: runCopy.failedBody(values.name, outcome.error.message),
          onOpen: () => openJob(id),
        })
      }
    },
  })

  // Aborting terminates the worker; the submit path records the
  // cancellation. There is nothing to cancel once no run is in flight.
  const cancelJob = () => {
    browserRunRef.current?.controller.abort()
    return Promise.resolve()
  }

  // Derive unified status/result/error. Submit-in-flight comes from the
  // mutation; everything after that reads the entry, including failures
  // (which are recorded as entries above). A thrown mutation error is a bug
  // rather than an expected failure, so it gets the generic message.
  let status: JobStatus = 'idle'
  let result: ProcessResult | null = null
  let error: JobError | null = null

  if (submitMutation.isError) {
    status = 'failed'
    error = { code: 'unknown', message: copy.unknown, retriable: true }
  } else if (entry) {
    status = entry.status
    result = entry.result
    error = entry.error
  } else if (submitMutation.isPending) {
    status = 'submitting'
  } else if (historyHydrated && jobId !== null && jobId === initialJobId) {
    // A `?job=` this browser has no record of: a link from another device,
    // or a cleared history. Shown as unavailable, without writing anything.
    status = 'failed'
    error = { code: 'not_found', message: copy.notFound, retriable: false }
  }

  const submitJob = async (values: FormValues) => {
    await submitMutation.mutateAsync(values)
  }

  return {
    submitJob,
    cancelJob,
    jobId,
    status,
    result,
    error,
    formValues: entry?.formValues ?? null,
    progress: progress?.progress,
    stage: progress?.stage,
    isLoading: status === 'submitting' || status === 'running',
    runsInBrowser,
    isRestoring:
      !historyHydrated && jobId !== null && jobId === initialJobId && !entry,
  }
}
