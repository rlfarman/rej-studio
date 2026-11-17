// useJob: designs run in the browser. Progress has to reach the history
// store, the finished design has to land on the same entry, cancelling has
// to stop the worker, and nothing may go over the network.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

import type { JobActionResult } from '@/features/design-tool/types/job-result'
import type { BackendProcessResult } from '@/features/design-tool/types/backend-contract'

vi.mock('@/features/design-tool/utils/form-handler', () => ({
  buildJobParams: vi.fn((values: { codingSequence: string; name: string }) => ({
    CDS: values.codingSequence,
    name: values.name,
    options: {},
  })),
}))

vi.mock('@/features/design-tool/api/browser-optimizer', () => ({
  browserOptimizerSupported: vi.fn(() => true),
  designInBrowser: vi.fn(),
  warmOptimizerWorker: vi.fn(),
  terminateOptimizerWorker: vi.fn(),
}))

vi.mock('@/features/design-tool/utils/finish-notification', () => ({
  notifyRunSettled: vi.fn(),
}))

import { notifyRunSettled } from '@/features/design-tool/utils/finish-notification'
import {
  browserOptimizerSupported,
  designInBrowser,
  warmOptimizerWorker,
} from '@/features/design-tool/api/browser-optimizer'
import {
  isBrowserJobId,
  useJobHistory,
  whenJobHistoryHydrated,
} from '@/features/design-tool/hooks/use-job-history'
import { useJob } from './use-job'

const mockFetch = vi.fn()
const mockDesign = vi.mocked(designInBrowser)
const mockSupported = vi.mocked(browserOptimizerSupported)
const mockWarm = vi.mocked(warmOptimizerWorker)
const mockNotify = vi.mocked(notifyRunSettled)

const unloadPrevented = () => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

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

const RESULT = {
  name: 'Test',
  original_sequence: 'ATGAAATGA',
  optimized_sequence: 'ATGAAGTGA',
  seq5: '[REJ5]ATGA',
  seq3: 'AGTGA[REJ3]',
  split_point: 4,
  used_wggw_as_split: false,
  objectives_before: 'before',
  objectives_after: 'after',
  objectives_report_before: { entries: [], total_score: null },
  objectives_report_after: { entries: [], total_score: null },
  wggw_info: null,
  processing_time_seconds: 0.2,
  seed: 1234,
} as unknown as BackendProcessResult

const succeeds = (): JobActionResult<BackendProcessResult> => ({
  ok: true,
  data: RESULT,
})

beforeEach(async () => {
  vi.clearAllMocks()
  await whenJobHistoryHydrated()
  mockSupported.mockReturnValue(true)
  vi.stubGlobal('fetch', mockFetch)
  useJobHistory.setState({ entries: [], progressById: {} })
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useJob', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    expect(result.current.status).toBe('idle')
    expect(result.current.jobId).toBeNull()
    expect(result.current.result).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('designs in the browser without a network request', async () => {
    mockDesign.mockResolvedValue(succeeds())
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => expect(result.current.status).toBe('completed'))
    expect(result.current.result?.optimized_sequence).toBe('ATGAAGTGA')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockDesign).toHaveBeenCalledTimes(1)
  })

  it('files the run under a browser id, which is never polled', async () => {
    mockDesign.mockResolvedValue(succeeds())
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => expect(result.current.jobId).toBeTruthy())
    expect(isBrowserJobId(result.current.jobId ?? '')).toBe(true)
    // A browser design exists only on this device, so it is not shareable.
    expect(window.location.search).not.toContain('job=')
  })

  it('feeds progress into the history store as the design runs', async () => {
    let report: ((fraction: number, stage: string) => void) | undefined
    let settle!: (value: JobActionResult<BackendProcessResult>) => void
    mockDesign.mockImplementation((_params, callbacks) => {
      report = callbacks?.onProgress
      // Stays in flight until the end of the test.
      return new Promise((resolve) => (settle = resolve))
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    act(() => {
      void result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => expect(report).toBeDefined())
    act(() => report?.(0.45, 'Optimizing sequence'))

    await waitFor(() => {
      expect(result.current.progress).toBe(0.45)
      expect(result.current.stage).toBe('Optimizing sequence')
    })
    expect(result.current.status).toBe('running')

    // Settle it, so the run's tab-close guard doesn't leak into later tests.
    await act(async () => settle(succeeds()))
    await waitFor(() => expect(result.current.status).toBe('completed'))
  })

  it('records a failed design against the same entry', async () => {
    mockDesign.mockResolvedValue({
      ok: false,
      error: {
        code: 'invalid_input',
        message: 'Coding sequence length is not a multiple of 3',
        retriable: false,
      },
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.error?.message).toContain('multiple of 3')
    // One entry, not a running one plus a separate failure.
    expect(useJobHistory.getState().entries).toHaveLength(1)
  })

  it('cancels by aborting the run', async () => {
    let abortSignal: AbortSignal | undefined
    mockDesign.mockImplementation((_params, callbacks) => {
      abortSignal = callbacks?.signal
      return new Promise((resolve) => {
        callbacks?.signal?.addEventListener('abort', () =>
          resolve({
            ok: false,
            error: { code: 'cancelled', message: 'Cancelled', retriable: true },
          }),
        )
      })
    })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    act(() => {
      void result.current.submitJob(FORM_VALUES)
    })
    await waitFor(() => expect(abortSignal).toBeDefined())

    await act(async () => {
      await result.current.cancelJob()
    })

    await waitFor(() => expect(result.current.status).toBe('cancelled'))
    expect(abortSignal?.aborted).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('starts loading the optimizer as soon as the form appears', () => {
    renderHook(() => useJob(), { wrapper: createWrapper() })
    expect(mockWarm).toHaveBeenCalled()
  })

  it('warns before the tab closes only while a run is in flight', async () => {
    let finish!: (value: JobActionResult<BackendProcessResult>) => void
    mockDesign.mockImplementation(
      () => new Promise((resolve) => (finish = resolve)),
    )
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    expect(unloadPrevented()).toBe(false)

    act(() => {
      void result.current.submitJob(FORM_VALUES)
    })
    await waitFor(() => expect(mockDesign).toHaveBeenCalled())
    expect(unloadPrevented()).toBe(true)

    await act(async () => finish(succeeds()))
    await waitFor(() => expect(result.current.status).toBe('completed'))
    expect(unloadPrevented()).toBe(false)
  })

  it('offers a finish notification on completion and failure, not on cancel', async () => {
    mockDesign.mockResolvedValueOnce(succeeds())
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })
    expect(mockNotify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: result.current.jobId,
        title: 'Design ready',
      }),
    )

    mockDesign.mockResolvedValueOnce({
      ok: false,
      error: { code: 'invalid_input', message: 'Bad', retriable: false },
    })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })
    expect(mockNotify).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Design failed', body: 'Test: Bad' }),
    )

    mockNotify.mockClear()
    mockDesign.mockResolvedValueOnce({
      ok: false,
      error: { code: 'cancelled', message: 'Cancelled', retriable: true },
    })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('settles the entry and lifts the warning when the run throws', async () => {
    mockDesign.mockRejectedValueOnce(new Error('worker crashed'))
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES).catch(() => {})
    })
    const [entry] = useJobHistory.getState().entries
    expect(entry.status).toBe('failed')
    expect(unloadPrevented()).toBe(false)
  })

  it('still runs where the browser lacks support, and reports why', async () => {
    // designInBrowser answers an unsupported browser with a failure saying
    // so (browser-optimizer.test.ts); there is no server to fall back to.
    mockSupported.mockReturnValue(false)
    mockDesign.mockResolvedValue({
      ok: false,
      error: { code: 'backend', message: 'Unsupported', retriable: false },
    })
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    expect(result.current.runsInBrowser).toBe(false)

    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })
    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.error?.message).toBe('Unsupported')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('reads a ?job= this browser has no record of as unavailable', () => {
    const { result } = renderHook(
      () => useJob({ initialJobId: 'from-another-device' }),
      { wrapper: createWrapper() },
    )
    expect(result.current.status).toBe('failed')
    expect(result.current.error?.code).toBe('not_found')
    // Nothing is written for it, and nothing polls it.
    expect(useJobHistory.getState().getEntry('from-another-device')).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows a ?job= from history as it was saved', () => {
    useJobHistory.getState().upsertEntry({
      id: 'browser-existing',
      status: 'completed',
    })
    const { result } = renderHook(
      () => useJob({ initialJobId: 'browser-existing' }),
      { wrapper: createWrapper() },
    )
    expect(result.current.status).toBe('completed')
    expect(useJobHistory.getState().getEntry('browser-existing')!.status).toBe(
      'completed',
    )
  })
})
