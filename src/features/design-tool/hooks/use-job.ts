import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  submitJob as submitJobAction,
  cancelJob as cancelJobAction,
} from '@/features/design-tool/api/jobs'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'
import {
  useJobHistory,
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

export function useJob({
  initialJobId = null,
}: UseJobOptions = {}): UseJobReturn {
  const [jobId, setJobIdState] = useState<string | null>(initialJobId)
  // Selector-scoped reads so this hook only re-renders when the specific
  // entry it cares about changes.
  const upsertEntry = useJobHistory((s) => s.upsertEntry)
  const entry = useJobHistory(
    (s) => s.entries.find((e) => e.id === jobId) ?? null,
  )
  const progress = useJobHistory((s) => (jobId ? s.progressById[jobId] : null))

  const setJobId = (next: string | null, { shareable = true } = {}) => {
    setJobIdState(next)
    if (shareable) writeJobToUrl(next)
  }

  // If the caller seeded an initialJobId but we have no history entry for it
  // (e.g. a shared URL from another device, or history was cleared), create
  // a running stub so the global watcher picks it up and polls.
  useEffect(() => {
    if (!initialJobId) return
    const existing = useJobHistory.getState().getEntry(initialJobId)
    if (!existing) {
      upsertEntry({ id: initialJobId, status: 'running' })
    }
    // upsertEntry is stable; only the id matters here.
  }, [initialJobId]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const outcome = await submitJobAction(buildJobParams(values))
      return { outcome, values }
    },
    onMutate: () => {
      setJobId(null)
    },
    onSuccess: ({ outcome, values }) => {
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
    if (!jobId || isLocalFailureId(jobId)) return
    await cancelMutation.mutateAsync(jobId)
  }

  // Derive unified status/result/error. Submit-in-flight comes from the
  // mutation; everything after that reads the entry, including failures
  // (which are recorded as entries above). A thrown mutation error is a bug
  // rather than an expected failure, so it gets the generic message.
  let status: JobStatus = 'idle'
  let result: ProcessResult | null = null
  let error: JobError | null = null

  if (submitMutation.isPending) {
    status = 'submitting'
  } else if (submitMutation.isError) {
    status = 'failed'
    error = { code: 'unknown', message: copy.unknown, retriable: true }
  } else if (entry) {
    status = entry.status
    result = entry.result
    error = entry.error
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
  }
}
