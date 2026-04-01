import { useState, useEffect, useRef, useCallback } from 'react'
import { submitModalJob, getModalJobStatus } from '@/actions/jobs'
import type { ProcessResult } from '@/design-tool/types/process-result'

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

export function useJob(): UseJobReturn {
  const [status, setStatus] = useState<JobStatus>('idle')
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => clearPolling, [clearPolling])

  const pollJob = useCallback(
    (callId: string) => {
      intervalRef.current = setInterval(async () => {
        try {
          const data = await getModalJobStatus(callId)

          if (data.status === 'completed') {
            clearPolling()
            setResult(data.result as unknown as ProcessResult)
            setStatus('completed')
          } else if (data.status === 'failed') {
            clearPolling()
            setError(
              (data.result?.error as string) ?? 'Job failed',
            )
            setStatus('failed')
          } else if (data.status === 'not_found') {
            clearPolling()
            setError('Job not found')
            setStatus('failed')
          }
          // status === 'running' -> keep polling
        } catch (err) {
          clearPolling()
          setError(
            err instanceof Error ? err.message : 'Failed to check job status',
          )
          setStatus('failed')
        }
      }, POLL_INTERVAL)
    },
    [clearPolling],
  )

  const submitJob = useCallback(
    async (params: {
      CDS: string
      name: string
      options: Record<string, unknown>
    }) => {
      clearPolling()
      setStatus('submitting')
      setResult(null)
      setError(null)

      try {
        const { call_id } = await submitModalJob(params)
        setStatus('running')
        pollJob(call_id)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to submit job',
        )
        setStatus('failed')
      }
    },
    [clearPolling, pollJob],
  )

  return {
    submitJob,
    status,
    result,
    error,
    isLoading: status === 'submitting' || status === 'running',
  }
}
