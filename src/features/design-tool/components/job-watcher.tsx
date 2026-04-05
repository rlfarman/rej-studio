'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJobStatus } from '@/features/design-tool/api/jobs'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { createLogger } from '@/lib/logger'

const POLL_INTERVAL = 2000
// Stop polling after this long — protects against a backend job that never
// resolves (stuck worker, lost call_id). The stale-running TTL in the
// history store (24h) is a safety net on top of this.
const POLL_DEADLINE_MS = 10 * 60 * 1000

const log = createLogger('job-watcher')

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
  const { upsertEntry, getEntry } = useJobHistory()
  const entry = getEntry(jobId)
  const [isPastDeadline, setIsPastDeadline] = useState(false)

  // Schedule a timer off the entry's createdAt. When the deadline hits,
  // flip local state — that disables the query and fires the failure
  // effect below. Reading Date.now() here (in an effect) is safe.
  useEffect(() => {
    if (!entry) return
    const createdAtMs = new Date(entry.createdAt).getTime()
    const remaining = Math.max(0, createdAtMs + POLL_DEADLINE_MS - Date.now())
    const timer = setTimeout(() => setIsPastDeadline(true), remaining)
    return () => clearTimeout(timer)
  }, [entry])

  const { data, error, isError } = useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => getJobStatus(jobId),
    enabled: !isPastDeadline,
    refetchInterval: (query) => {
      const d = query.state.data
      if (!d) return POLL_INTERVAL
      return d.status === 'running' ? POLL_INTERVAL : false
    },
    staleTime: 0,
    gcTime: 0,
  })

  // Deadline hit before backend resolved — give up and mark failed.
  useEffect(() => {
    if (!isPastDeadline) return
    log.warn('poll deadline exceeded', { jobId, deadlineMs: POLL_DEADLINE_MS })
    upsertEntry({
      id: jobId,
      status: 'failed',
      error: 'Timed out waiting for result',
    })
    // upsertEntry is stable
  }, [jobId, isPastDeadline]) // eslint-disable-line react-hooks/exhaustive-deps -- upsertEntry is stable

  // Sync poll outcome → history. upsertEntry preserves existing fields
  // (createdAt, formValues, name) so we only need to provide the new state.
  useEffect(() => {
    if (isError) {
      log.error('poll failed', error, { jobId })
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
      log.info('job completed', { jobId })
      upsertEntry({
        id: jobId,
        status: 'completed',
        result: data.result as unknown as ProcessResult,
      })
    } else if (data.status === 'failed') {
      log.warn('job failed', { jobId, error: data.result?.error })
      upsertEntry({
        id: jobId,
        status: 'failed',
        error: (data.result?.error as string) ?? 'Job failed',
      })
    } else if (data.status === 'not_found') {
      log.warn('job not found', { jobId })
      upsertEntry({
        id: jobId,
        status: 'failed',
        error: 'No longer available',
      })
    }
    // upsertEntry is stable
  }, [jobId, data, isError, error]) // eslint-disable-line react-hooks/exhaustive-deps -- upsertEntry is stable

  return null
}
