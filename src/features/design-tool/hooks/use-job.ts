import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  submitJob as submitJobAction,
  cancelJob as cancelJobAction,
} from '@/features/design-tool/api/jobs'
import {
  browserOptimizerSupported,
  designInBrowser,
  warmOptimizerWorker,
} from '@/features/design-tool/api/browser-optimizer'
import { BROWSER_OPTIMIZER_ENABLED } from '@/features/design-tool/utils/feature-flags'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'
import {
  BROWSER_ID_PREFIX,
  isBrowserJobId,
  useJobHistory,
  useJobHistoryHydrated,
  type JobStatus as EntryStatus,
  type JobError,
} from '@/features/design-tool/hooks/use-job-history'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { trackEvent } from '@/lib/analytics'
import { designToolCopy } from '@/features/design-tool/copy'

const copy = designToolCopy.jobErrors

type JobStatus = 'idle' | 'submitting' | EntryStatus

interface UseJobOptions {
  // If set, seeds jobId so derived state reads from this entry. A missing
  // entry is created as running so the global <JobWatcher> starts polling.
  initialJobId?: string | null
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
  /**
   * True while a resumed job's entry may still be loading from storage
   * (history hydrates asynchronously). Callers should show neither the
   * empty form nor "not found" until it clears.
   */
  isRestoring: boolean
}

const JOB_PARAM = 'job'

// Failed submissions never reached the backend, so they have no backend id.
// They still get a history entry (so "Run again" survives a reload) under a
// locally generated id, which is never written to the URL and never polled.
const LOCAL_FAILURE_PREFIX = 'local-fail-'

function isLocalFailureId(id: string): boolean {
  return id.startsWith(LOCAL_FAILURE_PREFIX)
}

// Shallow URL update — avoids re-running the server component (unlike
// router.replace), so form state is preserved during submission.
function writeJobToUrl(jobId: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (jobId) {
    url.searchParams.set(JOB_PARAM, jobId)
  } else {
    url.searchParams.delete(JOB_PARAM)
  }
  window.history.replaceState(null, '', url.toString())
}

/**
 * Whether this run should happen in the browser.
 *
 * Both the flag and real browser support are required; without support the
 * compute backend still serves the request, so an old browser degrades
 * rather than breaks.
 */
function useBrowserOptimizer(): boolean {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    if (!BROWSER_OPTIMIZER_ENABLED) return
    // Checked after mount: the server cannot know what the browser supports,
    // and deciding during render would risk a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is an external system, only knowable on the client
    setSupported(browserOptimizerSupported())
    // Start the download now, while the user is still entering a sequence.
    warmOptimizerWorker()
  }, [])
  return supported
}

export function useJob({
  initialJobId = null,
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

  const setJobId = (next: string | null, { shareable = true } = {}) => {
    setJobIdState(next)
    if (shareable) writeJobToUrl(next)
  }

  // If the caller seeded an initialJobId but we have no history entry for it
  // (e.g. a shared URL from another device, or history was cleared), create
  // a running stub so the global watcher picks it up and polls. Only once
  // the history has loaded: before that every id looks missing, and the stub
  // would poll (or overwrite) a job that is already settled.
  useEffect(() => {
    if (!initialJobId || !historyHydrated) return
    const existing = useJobHistory.getState().getEntry(initialJobId)
    if (!existing) {
      upsertEntry({ id: initialJobId, status: 'running' })
    }
    // upsertEntry is stable; only the id and the load matter here.
  }, [initialJobId, historyHydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const params = buildJobParams(values)
      if (!runsInBrowser) {
        return {
          kind: 'server' as const,
          outcome: await submitJobAction(params),
          values,
        }
      }

      // In-browser: the design runs here, so there is no job to poll. A local
      // id carries progress and the finished result through the same history
      // entry the backend path uses.
      const id = `${BROWSER_ID_PREFIX}${crypto.randomUUID()}`
      const controller = new AbortController()
      browserRunRef.current = { id, controller }

      upsertEntry({ id, status: 'running', formValues: values })
      useJobHistory
        .getState()
        .setProgress(id, { progress: 0.02, stage: 'Starting' })
      setJobId(id, { shareable: false })

      try {
        const outcome = await designInBrowser(params, {
          signal: controller.signal,
          onProgress: (progress, stage) =>
            useJobHistory.getState().setProgress(id, { progress, stage }),
        })
        return { kind: 'browser' as const, outcome, values, browserJobId: id }
      } finally {
        browserRunRef.current = null
      }
    },
    onMutate: () => {
      setJobId(null)
    },
    onError: () => {
      const run = browserRunRef.current
      if (!run) return
      upsertEntry({
        id: run.id,
        status: 'failed',
        error: { code: 'unknown', message: copy.unknown, retriable: true },
      })
      browserRunRef.current = null
    },
    onSuccess: (submission) => {
      const { values } = submission

      // A browser run already has its history entry (created when the design
      // started, so progress had somewhere to go); settle that one in place
      // rather than creating a second.
      if (submission.kind === 'browser') {
        // Destructured inside the branch so `outcome` narrows with `kind`.
        const { browserJobId, outcome } = submission
        if (outcome.ok) {
          upsertEntry({
            id: browserJobId,
            status: 'completed',
            result: outcome.data,
            formValues: values,
          })
          trackEvent({ event: 'job_submit', job_id: browserJobId })
          return
        }
        const cancelled = outcome.error.code === 'cancelled'
        upsertEntry({
          id: browserJobId,
          status: cancelled ? 'cancelled' : 'failed',
          error: outcome.error,
          formValues: values,
        })
        if (!cancelled) {
          trackEvent({
            event: 'job_failed',
            job_id: browserJobId,
            error_code: outcome.error.code,
          })
        }
        return
      }

      const { outcome } = submission
      if (!outcome.ok) {
        // Expected failure (rate limit, backend down, invalid input). Record
        // it so the run shows up in Recent jobs and "Run again" still works
        // after a reload, then surface it through the normal error path.
        const id = `${LOCAL_FAILURE_PREFIX}${crypto.randomUUID()}`
        upsertEntry({
          id,
          status: 'failed',
          error: outcome.error,
          formValues: values,
        })
        setJobId(id, { shareable: false })
        trackEvent({
          event: 'job_failed',
          job_id: id,
          error_code: outcome.error.code,
        })
        return
      }

      const { jobId: newJobId, result } = outcome.data
      if (result) {
        // Local backend: synchronous result. Record as completed immediately.
        upsertEntry({
          id: newJobId,
          status: 'completed',
          result,
          formValues: values,
        })
      } else {
        // Modal backend: pending. The global watcher will poll and upgrade.
        upsertEntry({ id: newJobId, status: 'running', formValues: values })
        // Seed a small initial progress so the bar appears immediately —
        // otherwise we wait for the first poll before anything shows.
        useJobHistory
          .getState()
          .setProgress(newJobId, { progress: 0.03, stage: 'Starting' })
      }
      setJobId(newJobId)
      trackEvent({ event: 'job_submit', job_id: newJobId })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => cancelJobAction(id),
    onSuccess: (outcome, id) => {
      // The watcher will also observe this on its next poll, but updating
      // eagerly gives an instant UI response.
      upsertEntry({
        id,
        status: 'cancelled',
        error: (outcome.ok ? outcome.data.error : outcome.error) ?? {
          code: 'cancelled',
          message: copy.cancelled,
          retriable: true,
        },
      })
    },
  })

  const cancelJob = async () => {
    // A browser run has no server-side job: aborting terminates the worker,
    // and the submit path records the cancellation.
    if (browserRunRef.current) {
      browserRunRef.current.controller.abort()
      return
    }
    if (!jobId || isLocalFailureId(jobId) || isBrowserJobId(jobId)) return
    await cancelMutation.mutateAsync(jobId)
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
    isRestoring:
      !historyHydrated && jobId !== null && jobId === initialJobId && !entry,
  }
}
