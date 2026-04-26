import { describe, expect, it, vi, beforeEach } from 'vitest'
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

import { submitJob as submitJobAction } from '@/features/design-tool/api/jobs'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'
import { useJob } from './use-job'

const mockSubmit = vi.mocked(submitJobAction)

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
  useJobHistory.setState({ entries: [] })
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
      jobId: 'local-123',
      result: fakeResult as any,
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
    mockSubmit.mockResolvedValue({ jobId: 'modal-456' })

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
    mockSubmit.mockResolvedValue({ jobId: 'modal-seed-1' })

    const { result } = renderHook(() => useJob(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.submitJob(FORM_VALUES)
    })

    await waitFor(() => {
      const entry = useJobHistory.getState().getEntry('modal-seed-1')
      expect(entry?.status).toBe('running')
      expect(entry?.progress).toBeGreaterThan(0)
      expect(entry?.progress).toBeLessThan(0.1)
      expect(entry?.stage).toBeTruthy()
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
