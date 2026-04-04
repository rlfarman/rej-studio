'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJobStatus } from '@/features/design-tool/api/jobs'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'
import type { ProcessResult } from '@/features/design-tool/types/process-result'

const POLL_INTERVAL = 2000

/**
 * Global background watcher for in-flight jobs. Mounted once in the layout
 * so pending jobs keep being polled even if the user navigates away from
 * the design tool. When a poll settles, the history entry is upgraded to
 * completed/failed — consumers (sidebar, useJob) react via the history
 * store automatically.
 *
 * TanStack Query dedupes by queryKey, so if the design-tool page is also
 * reading the same ['job-status', id] query there's still only one network
 * request per poll interval.
 */
export function JobWatcher() {
  const { entries } = useJobHistory()
  const runningIds = entries
    .filter((e) => e.status === 'running')
    .map((e) => e.id)

  return (
    <>
      {runningIds.map((id) => (
        <JobPoller key={id} jobId={id} />
      ))}
    </>
  )
}

interface JobPollerProps {
  jobId: string
}

function JobPoller({ jobId }: JobPollerProps) {
  const { upsertEntry } = useJobHistory()

  const { data, error, isError } = useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => getJobStatus(jobId),
    refetchInterval: (query) => {
      const d = query.state.data
      if (!d) return POLL_INTERVAL
      return d.status === 'running' ? POLL_INTERVAL : false
    },
    staleTime: 0,
    gcTime: 0,
  })

  // Sync poll outcome → history. upsertEntry preserves existing fields
  // (createdAt, formValues, name) so we only need to provide the new state.
  useEffect(() => {
    if (isError) {
      upsertEntry({
        id: jobId,
        status: 'failed',
        error:
          error instanceof Error ? error.message : 'Failed to check job status',
      })
      return
    }
    if (!data) return
    if (data.status === 'completed') {
      upsertEntry({
        id: jobId,
        status: 'completed',
        result: data.result as unknown as ProcessResult,
      })
    } else if (data.status === 'failed') {
      upsertEntry({
        id: jobId,
        status: 'failed',
        error: (data.result?.error as string) ?? 'Job failed',
      })
    } else if (data.status === 'not_found') {
      upsertEntry({
        id: jobId,
        status: 'failed',
        error: 'Job not found',
      })
    }
    // upsertEntry is stable
  }, [jobId, data, isError, error]) // eslint-disable-line react-hooks/exhaustive-deps -- upsertEntry is stable

  return null
}
