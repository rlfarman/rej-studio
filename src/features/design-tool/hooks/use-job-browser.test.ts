// useJob with the in-browser optimizer turned on.
//
// The server path is covered in use-job.test.ts; this covers the branch that
// runs the design here instead: progress has to reach the history store, the
// finished design has to land on the same entry, cancelling has to stop the
// worker, and the backend must not be called at all.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

import type { JobActionResult } from '@/features/design-tool/types/job-result'
import type { BackendProcessResult } from '@/features/design-tool/types/backend-contract'

vi.mock('@/features/design-tool/api/jobs', () => ({
  submitJob: vi.fn(),
  cancelJob: vi.fn(),
}))

vi.mock('@/features/design-tool/utils/form-handler', () => ({
  buildJobParams: vi.fn((values: { codingSequence: string; name: string }) => ({
    CDS: values.codingSequence,
    name: values.name,
    options: {},
  })),
}))

// The flag is read at module load, so it is stubbed rather than set via env.
vi.mock('@/features/design-tool/utils/feature-flags', () => ({
  BROWSER_OPTIMIZER_ENABLED: true,
  MULTI_SPLIT_ENABLED: false,
}))

vi.mock('@/features/design-tool/api/browser-optimizer', () => ({
  browserOptimizerSupported: vi.fn(() => true),
  designInBrowser: vi.fn(),
  warmOptimizerWorker: vi.fn(),
  terminateOptimizerWorker: vi.fn(),
}))

import {
  submitJob as submitJobAction,
  cancelJob as cancelJobAction,
} from '@/features/design-tool/api/jobs'
import {
  browserOptimizerSupported,
  designInBrowser,
  warmOptimizerWorker,
} from '@/features/design-tool/api/browser-optimizer'
import {
  isBrowserJobId,
  useJobHistory,
} from '@/features/design-tool/hooks/use-job-history'
import { useJob } from './use-job'

const mockSubmit = vi.mocked(submitJobAction)
const mockCancel = vi.mocked(cancelJobAction)
const mockDesign = vi.mocked(designInBrowser)
const mockSupported = vi.mocked(browserOptimizerSupported)
const mockWarm = vi.mocked(warmOptimizerWorker)

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

beforeEach(() => {
  vi.clearAllMocks()
  mockSupported.mockReturnValue(true)
  useJobHistory.setState({ entries: [], progressById: {} })
  localStorage.clear()
})

describe('useJob with the in-browser optimizer', () => {
  it('designs in the browser and never calls the backend', async () => {
    mockDesign.mockResolvedValue(succeeds())
    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => expect(result.current.status).toBe('completed'))
    expect(result.current.result?.optimized_sequence).toBe('ATGAAGTGA')
    expect(mockSubmit).not.toHaveBeenCalled()
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
    mockDesign.mockImplementation((_params, callbacks) => {
      report = callbacks?.onProgress
      return new Promise(() => {}) // never settles: the run stays in flight
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

  it('cancels by aborting the run rather than calling the backend', async () => {
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
    expect(mockCancel).not.toHaveBeenCalled()
  })

  it('starts loading the optimizer as soon as the form appears', () => {
    renderHook(() => useJob(), { wrapper: createWrapper() })
    expect(mockWarm).toHaveBeenCalled()
  })

  it('falls back to the backend when the browser cannot run it', async () => {
    mockSupported.mockReturnValue(false)
    mockSubmit.mockResolvedValue({ ok: true, data: { jobId: 'server-1' } })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => expect(result.current.jobId).toBe('server-1'))
    expect(mockSubmit).toHaveBeenCalledTimes(1)
    expect(mockDesign).not.toHaveBeenCalled()
  })
})
