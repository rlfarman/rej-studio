import { useCallback, useEffect, useState } from 'react'
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
  const entry = useJobHistory(
    (s) => s.entries.find((e) => e.id === jobId) ?? null,
  )

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

  const submitJob = useCallback(
    async (values: FormValues) => {
      await submitMutation.mutateAsync(values)
    },
    [submitMutation],
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
    isLoading: status === 'submitting' || status === 'running',
  }
}
