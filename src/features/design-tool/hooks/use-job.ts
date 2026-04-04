import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  submitJob as submitJobAction,
  getJobStatus,
} from '@/features/design-tool/api/jobs'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { ProcessResult } from '@/features/design-tool/types/process-result'

type JobStatus = 'idle' | 'submitting' | 'running' | 'completed' | 'failed'

interface UseJobReturn {
  submitJob: (params: {
    CDS: string
    name: string
    options: Record<string, unknown>
  }) => Promise<void>
  status: JobStatus
  result: ProcessResult | null
  error: string | null
  isLoading: boolean
}

const POLL_INTERVAL = 2000
const ACTIVE_JOB_KEY = 'rej-studio:active-job'

export function useJob(): UseJobReturn {
  // jobId drives the polling query. Persisted to survive tab reloads
  // while a modal backend job is in flight.
  const [jobId, setJobId] = useLocalStorage<string | null>(ACTIVE_JOB_KEY, null)
  // Inline result from local backend (not persisted — session-scoped).
  const [inlineResult, setInlineResult] = useState<ProcessResult | null>(null)
  const queryClient = useQueryClient()

  const submitMutation = useMutation({
    mutationFn: submitJobAction,
    onMutate: () => {
      setInlineResult(null)
      setJobId(null)
    },
    onSuccess: ({ jobId: newJobId, result }) => {
      if (result) {
        // Local backend: synchronous result, no polling.
        setInlineResult(result as unknown as ProcessResult)
        return
      }
      // Modal backend: kick off polling.
      setJobId(newJobId)
    },
  })

  const statusQuery = useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => getJobStatus(jobId as string),
    enabled: jobId !== null,
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
  } else if (jobId && statusQuery.data) {
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
  } else if (jobId && statusQuery.isError) {
    status = 'failed'
    error =
      statusQuery.error instanceof Error
        ? statusQuery.error.message
        : 'Failed to check job status'
  } else if (jobId) {
    status = 'running'
  }

  const submitJob = useCallback(
    async (params: {
      CDS: string
      name: string
      options: Record<string, unknown>
    }) => {
      // Drop any cached status for previous job IDs.
      queryClient.removeQueries({ queryKey: ['job-status'] })
      await submitMutation.mutateAsync(params)
    },
    [submitMutation, queryClient],
  )

  return {
    submitJob,
    status,
    result,
    error,
    isLoading: status === 'submitting' || status === 'running',
  }
}
