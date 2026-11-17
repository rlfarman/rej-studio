import { describe, expect, it, vi, beforeEach } from 'vite-plus/test'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// Mock job actions
vi.mock('@/features/design-tool/api/jobs', () => ({
  submitJob: vi.fn(),
  cancelJob: vi.fn(),
}))

vi.mock('@/features/design-tool/utils/form-handler', () => ({
  buildJobParams: vi.fn((v: any) => ({
    CDS: v.codingSequence,
    name: v.name,
    options: {},
  })),
}))

import {
  submitJob as submitJobAction,
  cancelJob as cancelJobAction,
} from '@/features/design-tool/api/jobs'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'
import { useJob } from './use-job'

const mockSubmit = vi.mocked(submitJobAction)
const mockCancel = vi.mocked(cancelJobAction)

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
  return Wrapper
}

const FORM_VALUES = {
  sequenceType: 'dna' as const,
  codingSequence: 'ATGAAATGA',
  proteinSequence: '',
  name: 'Test',
  species: 'human' as const,
  codonOptimizeWeight: 50,
  removeCrypticSpliceSites: false,
  removeCrypticSpliceSitesWeight: 50,
  minimizeCpgs: false,
  minimizeCpgsWeight: 50,
  reduceKmerComplexity: false,
  reduceKmerComplexityWeight: 50,
  enforceGcContent: false,
  '5PrimeStimulatoryIntron': false,
  '3PrimeStimulatoryIntron': false,
  spliceJunctionPositions: [3],
  selectedWggwSites: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  useJobHistory.setState({ entries: [], progressById: {} })
  localStorage.clear()
})

describe('useJob', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    expect(result.current.status).toBe('idle')
    expect(result.current.jobId).toBeNull()
    expect(result.current.result).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('transitions to completed on local backend (inline result)', async () => {
    const fakeResult = { name: 'Test', original_sequence: 'ATGAAATGA' }
    mockSubmit.mockResolvedValue({
      ok: true,
      data: { jobId: 'local-123', result: fakeResult as any },
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => {
      expect(result.current.jobId).toBe('local-123')
      expect(result.current.status).toBe('completed')
    })
  })

  it('transitions to running on modal backend (no inline result)', async () => {
    mockSubmit.mockResolvedValue({ ok: true, data: { jobId: 'modal-456' } })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => {
      expect(result.current.jobId).toBe('modal-456')
      expect(result.current.status).toBe('running')
    })
  })

  it('seeds initial progress on modal submit so the bar appears immediately', async () => {
    mockSubmit.mockResolvedValue({ ok: true, data: { jobId: 'modal-seed-1' } })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => {
      const entry = useJobHistory.getState().getEntry('modal-seed-1')
      expect(entry?.status).toBe('running')
      const progress = useJobHistory.getState().getProgress('modal-seed-1')
      expect(progress?.progress).toBeGreaterThan(0)
      expect(progress?.progress).toBeLessThan(0.1)
      expect(progress?.stage).toBeTruthy()
      // Progress is transient: it must not be written into the entry.
      expect(entry as unknown as Record<string, unknown>).not.toHaveProperty(
        'progress',
      )
    })
  })

  it('seeds history entry for initialJobId when missing', () => {
    renderHook(() => useJob({ initialJobId: 'seed-job-999' }), {
      wrapper: createWrapper(),
    })
    const entry = useJobHistory.getState().getEntry('seed-job-999')
    expect(entry).not.toBeNull()
    expect(entry!.status).toBe('running')
  })

  it('does not overwrite existing history entry for initialJobId', () => {
    useJobHistory.getState().upsertEntry({
      id: 'existing-job',
      status: 'completed',
    })
    renderHook(() => useJob({ initialJobId: 'existing-job' }), {
      wrapper: createWrapper(),
    })
    const entry = useJobHistory.getState().getEntry('existing-job')
    expect(entry!.status).toBe('completed') // not overwritten to 'running'
  })
})

describe('useJob — expected failures', () => {
  it('surfaces a returned error without throwing', async () => {
    mockSubmit.mockResolvedValue({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'wait 12s and try again',
        retriable: true,
      },
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => {
      expect(result.current.status).toBe('failed')
      expect(result.current.error?.code).toBe('rate_limited')
      // The backend's own wording survives — Next would have replaced a
      // thrown message with a generic digest in production.
      expect(result.current.error?.message).toContain('12s')
    })
  })

  // A failed submission used to vanish: no entry, so no "Run again" after a
  // reload and nothing in Recent jobs.
  it('records the failed run in history, with its inputs', async () => {
    mockSubmit.mockResolvedValue({
      ok: false,
      error: {
        code: 'network',
        message: 'optimizer unreachable',
        retriable: true,
      },
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => {
      const entries = useJobHistory.getState().entries
      expect(entries).toHaveLength(1)
      expect(entries[0].status).toBe('failed')
      expect(entries[0].error?.code).toBe('network')
      expect(entries[0].formValues?.codingSequence).toBe('ATGAAATGA')
      expect(entries[0].name).toBe('Test')
    })
  })

  it('keeps a local failure id out of the shareable URL', async () => {
    mockSubmit.mockResolvedValue({
      ok: false,
      error: { code: 'backend', message: 'down', retriable: true },
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(window.location.search).not.toContain('job=')
  })

  it('still records a failure when the action itself throws', async () => {
    mockSubmit.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES).catch(() => {})
    })

    await waitFor(() => {
      expect(result.current.status).toBe('failed')
      expect(result.current.error?.code).toBe('unknown')
    })
  })
})

describe('useJob — cancel', () => {
  it('marks the entry cancelled with the backend error', async () => {
    mockSubmit.mockResolvedValue({ ok: true, data: { jobId: 'cancel-me' } })
    mockCancel.mockResolvedValue({
      ok: true,
      data: {
        status: 'cancelled',
        error: { code: 'cancelled', message: 'Job cancelled', retriable: true },
      },
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })
    await act(async () => {
      await result.current.cancelJob()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('cancelled')
      expect(result.current.error?.code).toBe('cancelled')
    })
    expect(mockCancel).toHaveBeenCalledWith('cancel-me')
  })

  it('does not try to cancel a run that never reached the backend', async () => {
    mockSubmit.mockResolvedValue({
      ok: false,
      error: { code: 'network', message: 'unreachable', retriable: true },
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })
    await act(async () => {
      await result.current.cancelJob()
    })

    expect(mockCancel).not.toHaveBeenCalled()
  })

  // Re-running after a cancel must reach the backend again — the old
  // idempotency entry used to hand back the dead job id for 10 minutes.
  it('submits again after a cancel', async () => {
    mockSubmit.mockResolvedValue({ ok: true, data: { jobId: 'run-1' } })
    mockCancel.mockResolvedValue({
      ok: true,
      data: { status: 'cancelled' },
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })
    await act(async () => {
      await result.current.cancelJob()
    })
    await waitFor(() => expect(result.current.status).toBe('cancelled'))

    mockSubmit.mockResolvedValue({ ok: true, data: { jobId: 'run-2' } })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => {
      expect(result.current.jobId).toBe('run-2')
      expect(result.current.status).toBe('running')
    })
    expect(mockSubmit).toHaveBeenCalledTimes(2)
  })
})
