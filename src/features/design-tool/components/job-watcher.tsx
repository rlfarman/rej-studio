'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchJobStatusFromApi,
  JobStatusError,
} from '@/features/design-tool/api/job-status-client'
import {
  useJobHistory,
  isBrowserJobId,
  isSeedId,
} from '@/features/design-tool/hooks/use-job-history'
import type { JobError } from '@/features/design-tool/hooks/use-job-history'
import { POLL_DEADLINE_MS } from '@/features/design-tool/utils/job-constants'
import { createLogger } from '@/lib/logger'
import { trackEvent } from '@/lib/analytics'
import { designToolCopy } from '../copy'

const copy = designToolCopy.jobErrors

const POLL_INTERVAL = 2000
// Early polls are faster so we catch the quick 0.05/0.10/0.15 stage
// transitions before the backend races past them to optimize (~0.45).
const FAST_POLL_INTERVAL = 500
const FAST_POLL_COUNT = 3

// Exponential backoff for poll retries: 1s, 2s, 4s, 8s, then cap at 15s.
const MAX_POLL_RETRIES = 4

const log = createLogger('job-watcher')

/**
 * Global background watcher for in-flight jobs. Mounted once in the layout
 * so pending jobs keep being polled even if the user navigates away from
 * the design tool. When a poll settles, the history entry is upgraded to
 * completed/failed — consumers (sidebar, useJob) react via the history
 * store automatically.
 *
 * Polling goes through the `/api/jobs/[id]` route handler rather than a
 * server action: server actions are dispatched one at a time per client, so
 * a 0.5–2s poll loop would delay submits, cancels and gene searches.
 * TanStack Query dedupes by queryKey, so there is one request per interval
 * per job however many components watch it.
 */
export function JobWatcher() {
  // Selector subscription: only re-render when the set of running IDs
  // actually changes, not on every history mutation (e.g. progress ticks).
  // Skip seed-demo entries: they have no backend counterpart, so polling
  // would immediately flip them to failed(not_found) and defeat the point
  // of the demo.
  const runningIds = useJobHistory((s) =>
    s.entries
      .filter(
        (e) =>
          e.status === 'running' && !isSeedId(e.id) && !isBrowserJobId(e.id),
      )
      .map((e) => e.id)
      .join(','),
  )
  const ids = runningIds ? runningIds.split(',') : []

  return (
    <>
      {ids.map((id) => (
        <JobPoller key={id} jobId={id} />
      ))}
    </>
  )
}

interface JobPollerProps {
  jobId: string
}

function JobPoller({ jobId }: JobPollerProps) {
  const upsertEntry = useJobHistory((s) => s.upsertEntry)
  const setProgress = useJobHistory((s) => s.setProgress)
  const createdAt = useJobHistory(
    (s) => s.entries.find((e) => e.id === jobId)?.createdAt,
  )
  const [isPastDeadline, setIsPastDeadline] = useState(false)

  // Schedule a timer off the entry's createdAt. When the deadline hits,
  // flip local state — that disables the query and fires the failure
  // effect below. Reading Date.now() here (in an effect) is safe.
  useEffect(() => {
    if (!createdAt) return
    const createdAtMs = new Date(createdAt).getTime()
    const remaining = Math.max(0, createdAtMs + POLL_DEADLINE_MS - Date.now())
    const timer = setTimeout(() => setIsPastDeadline(true), remaining)
    return () => clearTimeout(timer)
  }, [createdAt])

  const { data, error, isError } = useQuery({
    queryKey: ['job-status', jobId],
    queryFn: ({ signal }) => fetchJobStatusFromApi(jobId, signal),
    enabled: !isPastDeadline,
    refetchInterval: (query) => {
      const d = query.state.data
      if (!d) return FAST_POLL_INTERVAL
      if (d.status !== 'running') return false
      return query.state.dataUpdateCount < FAST_POLL_COUNT
        ? FAST_POLL_INTERVAL
        : POLL_INTERVAL
    },
    // Pause polling when the tab is backgrounded — TanStack Query's focus
    // manager already does this, but being explicit makes the intent clear
    // and guards against a future default change.
    refetchIntervalInBackground: false,
    // Exponential backoff on transient errors. Most poll failures are
    // network blips; retrying a few times before surfacing 'failed' cuts
    // down on false positives. A structured non-retriable error (a bad
    // token, say) fails fast.
    retry: (failureCount, err) => {
      if (err instanceof JobStatusError && !err.jobError.retriable) return false
      return failureCount < MAX_POLL_RETRIES
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
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
      error: {
        code: 'timeout',
        message: copy.pollTimeout,
        retriable: true,
      },
    })
    // upsertEntry is stable
  }, [jobId, isPastDeadline]) // eslint-disable-line react-hooks/exhaustive-deps -- upsertEntry is stable

  // Sync poll outcome → history. upsertEntry preserves existing fields
  // (createdAt, formValues, name) so we only need to provide the new state.
  useEffect(() => {
    if (isError) {
      log.error('poll failed', error, { jobId })
      const jobError: JobError =
        error instanceof JobStatusError
          ? error.jobError
          : { code: 'network', message: copy.unreachable, retriable: true }
      upsertEntry({ id: jobId, status: 'failed', error: jobError })
      trackEvent({
        event: 'job_failed',
        job_id: jobId,
        error_code: jobError.code,
      })
      return
    }
    if (!data) return
    if (data.status === 'completed') {
      log.info('job completed', { jobId })
      const result = data.result ?? null
      if (!result) {
        // "completed" with no payload is a backend bug, not a usable run.
        upsertEntry({
          id: jobId,
          status: 'failed',
          error: {
            code: 'backend',
            message: copy.unexpectedResponse,
            retriable: true,
          },
        })
        return
      }
      upsertEntry({ id: jobId, status: 'completed', result })
      trackEvent({
        event: 'job_complete',
        job_id: jobId,
        sequence_length: result.optimized_sequence.length,
        processing_time_seconds: result.processing_time_seconds,
      })
    } else if (data.status === 'running') {
      // Surface progress/stage as they arrive, so the sidebar and inline
      // spinner can show something better than a blank indefinite loader.
      // This writes to the non-persisted progress slice — a tick must not
      // rewrite the whole history to localStorage.
      if (data.progress != null || data.stage != null) {
        setProgress(jobId, {
          progress: data.progress ?? undefined,
          stage: data.stage ?? undefined,
        })
      }
    } else if (data.status === 'failed') {
      log.warn('job failed', { jobId, error: data.error })
      const jobError: JobError = data.error ?? {
        code: 'backend',
        message: copy.failed,
        retriable: false,
      }
      upsertEntry({ id: jobId, status: 'failed', error: jobError })
      trackEvent({
        event: 'job_failed',
        job_id: jobId,
        error_code: jobError.code,
      })
    } else if (data.status === 'cancelled') {
      log.info('job cancelled', { jobId })
      upsertEntry({
        id: jobId,
        status: 'cancelled',
        error: data.error ?? {
          code: 'cancelled',
          message: copy.cancelled,
          retriable: true,
        },
      })
    } else if (data.status === 'not_found') {
      log.warn('job not found', { jobId })
      upsertEntry({
        id: jobId,
        status: 'failed',
        error: {
          code: 'not_found',
          message: copy.notFound,
          retriable: false,
        },
      })
    }
    // upsertEntry and setProgress are stable
  }, [jobId, data, isError, error]) // eslint-disable-line react-hooks/exhaustive-deps -- store actions are stable

  return null
}
