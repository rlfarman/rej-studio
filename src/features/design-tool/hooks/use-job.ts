import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  submitJob as submitJobAction,
  getJobStatus,
} from '@/features/design-tool/api/jobs'
import type { ProcessResult } from '@/features/design-tool/types/process-result'

type JobStatus = 'idle' | 'submitting' | 'running' | 'completed' | 'failed'

interface UseJobReturn {
  submitJob: (params: {
    CDS: string
    name: string
    options: Record<string, unknown>
  }) => Promise<void>
  // Resume polling for an existing (modal-backend) job by id. Use this when a
  // job id is present in the URL on mount and the caller has determined that
  // the result is NOT already cached in local history.
  resume: (jobId: string) => void
  jobId: string | null
  status: JobStatus
  result: ProcessResult | null
  error: string | null
  isLoading: boolean
}

const POLL_INTERVAL = 2000
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

export function useJob(): UseJobReturn {
  const [jobId, setJobIdState] = useState<string | null>(null)
  // Inline result from local backend (completed synchronously at submit time).
  const [inlineResult, setInlineResult] = useState<ProcessResult | null>(null)
  // Polling is on when we have a modal jobId whose result we don't yet know.
  const [isPolling, setIsPolling] = useState<boolean>(false)
  const queryClient = useQueryClient()

  const setJobId = useCallback((next: string | null) => {
    setJobIdState(next)
    writeJobToUrl(next)
  }, [])

  const submitMutation = useMutation({
    mutationFn: submitJobAction,
    onMutate: () => {
      setInlineResult(null)
      setIsPolling(false)
      setJobId(null)
    },
    onSuccess: ({ jobId: newJobId, result }) => {
      if (result) {
        // Local backend: result is already here. Server-assigned jobId.
        setInlineResult(result as unknown as ProcessResult)
        setJobId(newJobId)
        return
      }
      // Modal backend: jobId is the Modal call_id, start polling.
      setIsPolling(true)
      setJobId(newJobId)
    },
  })

  const resume = useCallback(
    (id: string) => {
      setInlineResult(null)
      setJobId(id)
      setIsPolling(true)
    },
    [setJobId],
  )

  const statusQuery = useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => getJobStatus(jobId as string),
    enabled: isPolling && jobId !== null,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return POLL_INTERVAL
      return data.status === 'running' ? POLL_INTERVAL : false
    },
    staleTime: 0,
    gcTime: 0,
  })

  // Derive unified status/result/error.
  let status: JobStatus = 'idle'
  let result: ProcessResult | null = null
  let error: string | null = null

  if (submitMutation.isPending) {
    status = 'submitting'
  } else if (submitMutation.isError) {
    status = 'failed'
    error =
      submitMutation.error instanceof Error
        ? submitMutation.error.message
        : 'Failed to submit job'
  } else if (inlineResult) {
    status = 'completed'
    result = inlineResult
  } else if (isPolling && statusQuery.data) {
    const data = statusQuery.data
    if (data.status === 'completed') {
      status = 'completed'
      result = data.result as unknown as ProcessResult
    } else if (data.status === 'failed') {
      status = 'failed'
      error = (data.result?.error as string) ?? 'Job failed'
    } else if (data.status === 'not_found') {
      status = 'failed'
      error = 'Job not found'
    } else {
      status = 'running'
    }
  } else if (isPolling && statusQuery.isError) {
    status = 'failed'
    error =
      statusQuery.error instanceof Error
        ? statusQuery.error.message
        : 'Failed to check job status'
  } else if (isPolling) {
    status = 'running'
  }

  const submitJob = useCallback(
    async (params: {
      CDS: string
      name: string
      options: Record<string, unknown>
    }) => {
      queryClient.removeQueries({ queryKey: ['job-status'] })
      await submitMutation.mutateAsync(params)
    },
    [submitMutation, queryClient],
  )

  return {
    submitJob,
    resume,
    jobId,
    status,
    result,
    error,
    isLoading: status === 'submitting' || status === 'running',
  }
}
