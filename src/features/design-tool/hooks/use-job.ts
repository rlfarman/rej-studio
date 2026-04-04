import { useState, useEffect, useRef, useCallback } from 'react'
import { submitJob as submitJobAction, getJobStatus } from '@/features/design-tool/api/jobs'
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
const MAX_RETRIES = 3
const ACTIVE_JOB_KEY = 'rej-studio:active-job'

function saveActiveJob(jobId: string) {
  try {
    localStorage.setItem(ACTIVE_JOB_KEY, jobId)
  } catch {}
}

function clearActiveJob() {
  try {
    localStorage.removeItem(ACTIVE_JOB_KEY)
  } catch {}
}

function loadActiveJob(): string | null {
  try {
    return localStorage.getItem(ACTIVE_JOB_KEY)
  } catch {
    return null
  }
}

export function useJob(): UseJobReturn {
  const [status, setStatus] = useState<JobStatus>('idle')
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retriesRef = useRef(0)

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    retriesRef.current = 0
  }, [])

  useEffect(() => clearPolling, [clearPolling])

  const pollJob = useCallback(
    (callId: string) => {
      intervalRef.current = setInterval(async () => {
        try {
          const data = await getJobStatus(callId)

          // Reset retry counter on success
          retriesRef.current = 0

          if (data.status === 'completed') {
            clearPolling()
            clearActiveJob()
            setResult(data.result as unknown as ProcessResult)
            setStatus('completed')
          } else if (data.status === 'failed') {
            clearPolling()
            clearActiveJob()
            setError(
              (data.result?.error as string) ?? 'Job failed',
            )
            setStatus('failed')
          } else if (data.status === 'not_found') {
            clearPolling()
            clearActiveJob()
            setError('Job not found')
            setStatus('failed')
          }
          // status === 'running' -> keep polling
        } catch (err) {
          retriesRef.current += 1
          if (retriesRef.current >= MAX_RETRIES) {
            clearPolling()
            clearActiveJob()
            setError(
              err instanceof Error
                ? err.message
                : 'Failed to check job status',
            )
            setStatus('failed')
          }
          // Otherwise silently retry on next interval
        }
      }, POLL_INTERVAL)
    },
    [clearPolling],
  )

  // Resume polling for an active job on mount
  useEffect(() => {
    const activeJobId = loadActiveJob()
    if (activeJobId) {
      setStatus('running')
      pollJob(activeJobId)
    }
  }, [pollJob])

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
        const { jobId, result: inlineResult } = await submitJobAction(params)

        // Local backend returns the result inline — no polling needed
        if (inlineResult) {
          setResult(inlineResult as unknown as ProcessResult)
          setStatus('completed')
          return
        }

        saveActiveJob(jobId)
        setStatus('running')
        pollJob(jobId)
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
