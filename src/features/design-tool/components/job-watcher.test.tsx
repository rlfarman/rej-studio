/**
 * The watcher's state machine: each backend status must land the history
 * entry in the right terminal (or running) state, and polling must go
 * through the route handler rather than a server action.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

const { mockFetchStatus } = vi.hoisted(() => ({
  mockFetchStatus: vi.fn(),
}))

vi.mock('@/features/design-tool/api/job-status-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/design-tool/api/job-status-client')
  >('@/features/design-tool/api/job-status-client')
  return {
    ...actual,
    fetchJobStatusFromApi: mockFetchStatus,
  }
})

import { JobStatusError } from '@/features/design-tool/api/job-status-client'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'
import { JobWatcher } from './job-watcher'

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function startRunningJob(id = 'job-1') {
  useJobHistory.getState().upsertEntry({ id, status: 'running' })
  return id
}

const entry = (id: string) => useJobHistory.getState().getEntry(id)

const COMPLETED_RESULT = {
  name: 'TP53',
  original_sequence: 'ATGAAATGA',
  optimized_sequence: 'ATGAAGTGA',
  seq5: 'ATGAA',
  seq3: 'GTGA',
  split_point: 5,
  used_wggw_as_split: false,
  objectives_before: '',
  objectives_after: '',
  objectives_report_before: { entries: [], total_score: null },
  objectives_report_after: { entries: [], total_score: null },
  wggw_info: null,
  processing_time_seconds: 2.5,
}

beforeEach(() => {
  vi.clearAllMocks()
  useJobHistory.setState({ entries: [], progressById: {} })
  localStorage.clear()
})

afterEach(() => cleanup())

describe('JobWatcher state machine', () => {
  it('running → completed stores the parsed result', async () => {
    const id = startRunningJob()
    mockFetchStatus.mockResolvedValue({
      status: 'completed',
      result: COMPLETED_RESULT,
    })

    render(<JobWatcher />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(entry(id)!.status).toBe('completed')
      expect(entry(id)!.result?.optimized_sequence).toBe('ATGAAGTGA')
    })
  })

  it('running → failed keeps the backend error code and retriable flag', async () => {
    const id = startRunningJob()
    mockFetchStatus.mockResolvedValue({
      status: 'failed',
      error: {
        code: 'invalid_input',
        message: 'impossible constraints',
        retriable: false,
      },
    })

    render(<JobWatcher />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(entry(id)!.status).toBe('failed')
      expect(entry(id)!.error).toEqual({
        code: 'invalid_input',
        message: 'impossible constraints',
        retriable: false,
      })
    })
  })

  it('running → cancelled marks the entry cancelled', async () => {
    const id = startRunningJob()
    mockFetchStatus.mockResolvedValue({
      status: 'cancelled',
      error: { code: 'cancelled', message: 'Job cancelled', retriable: true },
    })

    render(<JobWatcher />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(entry(id)!.status).toBe('cancelled')
      expect(entry(id)!.error?.code).toBe('cancelled')
    })
  })

  it('running → not_found fails non-retriably', async () => {
    const id = startRunningJob()
    mockFetchStatus.mockResolvedValue({ status: 'not_found' })

    render(<JobWatcher />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(entry(id)!.status).toBe('failed')
      expect(entry(id)!.error?.code).toBe('not_found')
      expect(entry(id)!.error?.retriable).toBe(false)
    })
  })

  it('a completed status with no payload is treated as a failure', async () => {
    const id = startRunningJob()
    mockFetchStatus.mockResolvedValue({ status: 'completed' })

    render(<JobWatcher />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(entry(id)!.status).toBe('failed')
      expect(entry(id)!.error?.code).toBe('backend')
    })
  })

  it('a poll error carries the structured backend error through', async () => {
    const id = startRunningJob()
    mockFetchStatus.mockRejectedValue(
      new JobStatusError({
        code: 'unauthorized',
        message: 'session expired',
        retriable: false,
      }),
    )

    render(<JobWatcher />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(entry(id)!.status).toBe('failed')
      expect(entry(id)!.error?.code).toBe('unauthorized')
    })
  })

  it('progress ticks land in the transient slice, not the entry', async () => {
    const id = startRunningJob()
    mockFetchStatus.mockResolvedValue({
      status: 'running',
      progress: 0.45,
      stage: 'Optimizing',
    })

    render(<JobWatcher />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(useJobHistory.getState().getProgress(id)).toEqual({
        progress: 0.45,
        stage: 'Optimizing',
      })
    })
    expect(entry(id)!.status).toBe('running')
    const persisted = localStorage.getItem('rej-studio:job-history') ?? ''
    expect(persisted).not.toContain('Optimizing')
  })

  it('times out a job whose deadline has already passed', async () => {
    const id = 'stale-job'
    useJobHistory.getState().upsertEntry({ id, status: 'running' })
    // Backdate past the poll deadline (11 minutes).
    useJobHistory.setState((state) => ({
      entries: state.entries.map((e) =>
        e.id === id
          ? {
              ...e,
              createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
            }
          : e,
      ),
    }))
    mockFetchStatus.mockResolvedValue({ status: 'running' })

    render(<JobWatcher />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(entry(id)!.status).toBe('failed')
      expect(entry(id)!.error?.code).toBe('timeout')
      expect(entry(id)!.error?.retriable).toBe(true)
    })
  })

  it('never polls seeded demo jobs', async () => {
    startRunningJob('seed-job-running-1')
    render(<JobWatcher />, { wrapper: Wrapper })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockFetchStatus).not.toHaveBeenCalled()
  })
})
