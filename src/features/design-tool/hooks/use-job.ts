import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  submitJob as submitJobAction,
  cancelJob as cancelJobAction,
} from '@/features/design-tool/api/jobs'
import { submitJobStream } from '@/features/design-tool/api/jobs-stream'
import { startViewTransition } from '@/lib/view-transition'
import { flushSync } from 'react-dom'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'
import {
  useJobHistory,
  type JobStatus as EntryStatus,
  type JobError,
} from '@/features/design-tool/hooks/use-job-history'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { trackEvent } from '@/lib/analytics'

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
  const removeEntry = useJobHistory((s) => s.removeEntry)
  const entry = useJobHistory(
    (s) => s.entries.find((e) => e.id === jobId) ?? null,
  )
  // Track in-flight stream so a submit-during-submit doesn't double-start.
  // Also lets a future cancel abort the fetch if we wire that up.
  const streamAbortRef = useRef<AbortController | null>(null)
  // True while a streaming submit is running — distinct from the
  // server-action mutation's `isPending`, so derived `status` can surface it.
  const [isStreamingSubmit, setIsStreamingSubmit] = useState(false)

  const setJobId = useCallback((next: string | null) => {
    setJobIdState(next)
    writeJobToUrl(next)
  }, [])

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
      const result = await submitJobAction(buildJobParams(values))
      return { ...result, values }
    },
    onMutate: () => {
      setJobId(null)
    },
    onSuccess: ({ jobId: newJobId, result, values }) => {
      if (result) {
        // Local backend: synchronous result. Record as completed immediately.
        upsertEntry({
          id: newJobId,
          status: 'completed',
          result: result as unknown as ProcessResult,
          formValues: values,
        })
      } else {
        // Modal backend: pending. The global watcher will poll and upgrade.
        upsertEntry({
          id: newJobId,
          status: 'running',
          formValues: values,
        })
      }
      setJobId(newJobId)
      trackEvent({ event: 'job_submit', job_id: newJobId })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => cancelJobAction(id),
    onSuccess: (data, id) => {
      // The watcher will also observe this on its next poll, but updating
      // eagerly gives an instant UI response.
      upsertEntry({
        id,
        status: 'cancelled',
        error: data.error
          ? { ...data.error, code: data.error.code as JobError['code'] }
          : { code: 'cancelled', message: 'Cancelled', retriable: true },
      })
    },
  })

  const cancelJob = useCallback(async () => {
    if (!jobId) return
    await cancelMutation.mutateAsync(jobId)
  }, [jobId, cancelMutation])

  // Derive unified status/result/error. Submit-in-flight and submit-errored
  // states come from the mutation; everything after that reads the entry.
  let status: JobStatus = 'idle'
  let result: ProcessResult | null = null
  let error: JobError | null = null

  if (submitMutation.isPending) {
    status = 'submitting'
  } else if (submitMutation.isError) {
    status = 'failed'
    error = {
      code: 'network',
      message:
        submitMutation.error instanceof Error
          ? submitMutation.error.message
          : 'Failed to submit job',
      retriable: true,
    }
  } else if (entry) {
    status = entry.status
    result = entry.result
    error = entry.error
  }

  // Try the streaming endpoint first (local FastAPI only; 404s on Modal/prod).
  // Falls back to the server-action path if the stream can't connect or never
  // produces a terminal event.
  const submitJob = useCallback(
    async (values: FormValues) => {
      // If a stream is already open, swap it out — user re-submitted.
      streamAbortRef.current?.abort()

      const params = buildJobParams(values)
      const streamId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : String(Date.now()) + '-' + Math.random().toString(36).slice(2)

      // Wrap the state change that actually mounts the RunCard in a View
      // Transition so the submit button morphs into the run surface.
      // flushSync forces the state update to paint before the transition
      // captures the "new" snapshot. Without it React might batch the
      // update past the transition window.
      trackEvent({ event: 'job_submit', job_id: streamId })
      await startViewTransition(() => {
        flushSync(() => {
          setJobId(streamId)
          upsertEntry({ id: streamId, status: 'running', formValues: values })
          setIsStreamingSubmit(true)
        })
      })

      const controller = new AbortController()
      streamAbortRef.current = controller

      try {
        const attempt = await submitJobStream(
          params,
          (ev) => {
            if (ev.type === 'progress') {
              upsertEntry({
                id: streamId,
                status: 'running',
                progress: ev.frac,
                stage: ev.stage,
              })
            }
          },
          controller.signal,
        )

        if (attempt.ok && attempt.result) {
          upsertEntry({
            id: streamId,
            status: 'completed',
            result: attempt.result,
            formValues: values,
          })
          trackEvent({
            event: 'job_complete',
            job_id: streamId,
            sequence_length: attempt.result.optimized_sequence?.length ?? 0,
            processing_time_seconds:
              attempt.result.processing_time_seconds ?? 0,
          })
          return
        }

        if (attempt.terminal === 'error' && attempt.error) {
          upsertEntry({
            id: streamId,
            status: 'failed',
            error: {
              code: 'backend',
              message: attempt.error,
              retriable: false,
            },
          })
          trackEvent({
            event: 'job_failed',
            job_id: streamId,
            error_code: 'backend',
          })
          return
        }

        // Stream unavailable (prod/Modal) or died mid-flight with no terminal
        // event. Drop the streaming stub and fall back to the server action,
        // which has its own retry/rate-limiting logic.
        removeEntry(streamId)
        await submitMutation.mutateAsync(values)
      } finally {
        streamAbortRef.current = null
        setIsStreamingSubmit(false)
      }
    },
    [submitMutation, upsertEntry, removeEntry, setJobId],
  )

  return {
    submitJob,
    cancelJob,
    jobId,
    status,
    result,
    error,
    formValues: entry?.formValues ?? null,
    progress: entry?.progress,
    stage: entry?.stage,
    isLoading:
      isStreamingSubmit || status === 'submitting' || status === 'running',
  }
}
