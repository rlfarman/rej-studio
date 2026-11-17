// useJob, for designs run in the cloud: the submission files a history entry
// under the cloud id, the poller is told, a `?job=` this browser has never
// seen is read from the cloud, and "Delete from cloud" keeps the local copy.
// The /api/designs client is mocked; its own wire format is covered by the
// Worker's handler tests.

import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { FormValues } from '@/features/design-tool/types/form-schema'
import type { ProcessResult } from '@/features/design-tool/types/process-result'

vi.mock('@/features/design-tool/api/cloud-designs', () => ({
  submitCloudDesign: vi.fn(),
  fetchCloudDesign: vi.fn(),
  deleteCloudDesign: vi.fn(),
}))
vi.mock('@/features/design-tool/api/browser-optimizer', () => ({
  browserOptimizerSupported: vi.fn(() => true),
  designInBrowser: vi.fn(),
  warmOptimizerWorker: vi.fn(),
}))
vi.mock('@/features/design-tool/utils/cloud-runs', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/design-tool/utils/cloud-runs')
  >()),
  cloudRuns: { start: vi.fn(), wake: vi.fn(), stop: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import {
  deleteCloudDesign,
  fetchCloudDesign,
  submitCloudDesign,
} from '@/features/design-tool/api/cloud-designs'
import { designInBrowser } from '@/features/design-tool/api/browser-optimizer'
import {
  useJobHistory,
  whenJobHistoryHydrated,
} from '@/features/design-tool/hooks/use-job-history'
import { cloudRuns } from '@/features/design-tool/utils/cloud-runs'
import { useJob } from './use-job'

const ID = 'd'.repeat(64)

const VALUES: FormValues = {
  selectedWggwSites: [null],
  sequenceType: 'dna',
  codingSequence: `ATG${'AAA'.repeat(30)}TAA`,
  proteinSequence: '',
  name: 'Cloud run',
  species: 'human',
  codonOptimizeWeight: 1,
  removeCrypticSpliceSites: true,
  removeCrypticSpliceSitesWeight: 1,
  minimizeCpgs: true,
  minimizeCpgsWeight: 1,
  reduceKmerComplexity: true,
  reduceKmerComplexityWeight: 1,
  enforceGcContent: true,
  '5PrimeStimulatoryIntron': false,
  '3PrimeStimulatoryIntron': false,
  spliceJunctionPositions: [45],
}

const RESULT = {
  name: 'Cloud run',
  original_sequence: VALUES.codingSequence,
  optimized_sequence: VALUES.codingSequence,
  seq5: 'ATG',
  seq3: 'TAA',
  split_point: 45,
  used_wggw_as_split: false,
  objectives_before: '',
  objectives_after: '',
  objectives_report_before: { entries: [], total_score: null },
  objectives_report_after: { entries: [], total_score: null },
  wggw_info: null,
  processing_time_seconds: 0,
} as ProcessResult

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return createElement(QueryClientProvider, { client }, children)
}

beforeEach(async () => {
  vi.clearAllMocks()
  await whenJobHistoryHydrated()
  useJobHistory.setState({ entries: [], progressById: {} })
})

describe('submitting to the cloud', () => {
  it('files a running entry under the cloud id and wakes the poller, running nothing here', async () => {
    vi.mocked(submitCloudDesign).mockResolvedValue({
      ok: true,
      data: { id: ID, status: 'queued', existing: false },
    })
    const onCloudJob = vi.fn()
    const { result } = renderHook(() => useJob({ onCloudJob }), { wrapper })

    await act(async () => {
      await result.current.submitJob(VALUES, { cloud: true })
    })

    expect(designInBrowser).not.toHaveBeenCalled()
    expect(useJobHistory.getState().getEntry(ID)).toMatchObject({
      status: 'running',
      cloudId: ID,
      name: 'Cloud run',
    })
    expect(cloudRuns.wake).toHaveBeenCalled()
    expect(onCloudJob).toHaveBeenCalledWith(ID)
    expect(result.current.status).toBe('running')
    expect(result.current.cloud).toMatchObject({ id: ID, deleted: false })
    expect(result.current.cloud?.estimateSeconds).toBeGreaterThan(0)
  })

  it('keeps a completed copy when the same design is resubmitted', async () => {
    useJobHistory.getState().upsertEntry({
      id: ID,
      status: 'completed',
      result: RESULT,
      formValues: VALUES,
      cloudId: ID,
    })
    vi.mocked(submitCloudDesign).mockResolvedValue({
      ok: true,
      data: { id: ID, status: 'completed', existing: true },
    })
    const { result } = renderHook(() => useJob(), { wrapper })

    await act(async () => {
      await result.current.submitJob(VALUES, { cloud: true })
    })

    expect(result.current.status).toBe('completed')
    expect(useJobHistory.getState().entries).toHaveLength(1)
  })

  it('shows the Worker’s refusal and files nothing', async () => {
    vi.mocked(submitCloudDesign).mockResolvedValue({
      ok: false,
      status: 429,
      message: 'Too many cloud designs in the last minute.',
    })
    const { result } = renderHook(() => useJob(), { wrapper })

    await act(async () => {
      await result.current.submitJob(VALUES, { cloud: true }).catch(() => {})
    })

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.error?.message).toBe(
      'Too many cloud designs in the last minute.',
    )
    expect(useJobHistory.getState().entries).toHaveLength(0)
  })

  it('refuses a sequence over the cloud cap without sending it', async () => {
    const { result } = renderHook(() => useJob(), { wrapper })
    const long = `ATG${'AAA'.repeat(15_000)}TAA`

    await act(async () => {
      await result.current
        .submitJob({ ...VALUES, codingSequence: long }, { cloud: true })
        .catch(() => {})
    })

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.error?.message).toMatch(/45,000/)
    expect(submitCloudDesign).not.toHaveBeenCalled()
  })
})

describe('a ?job= link to a cloud design', () => {
  it('reads a design this browser has never seen from the cloud, and keeps it', async () => {
    vi.mocked(fetchCloudDesign).mockResolvedValue({
      ok: true,
      data: { id: ID, status: 'completed', values: VALUES, result: RESULT },
    })
    const { result } = renderHook(() => useJob({ initialJobId: ID }), {
      wrapper,
    })

    expect(result.current.isRestoring).toBe(true)
    await waitFor(() => expect(result.current.status).toBe('completed'))
    expect(result.current.result?.optimized_sequence).toBe(
      RESULT.optimized_sequence,
    )
    expect(result.current.formValues?.name).toBe('Cloud run')
    expect(useJobHistory.getState().getEntry(ID)?.cloudId).toBe(ID)
  })

  it('says it is no longer available when the cloud does not have it', async () => {
    vi.mocked(fetchCloudDesign).mockResolvedValue({
      ok: false,
      status: 404,
      message: 'No cloud design with that id.',
    })
    const { result } = renderHook(() => useJob({ initialJobId: ID }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.error?.code).toBe('not_found')
  })

  it('does not call the cloud for a browser run’s id', async () => {
    const { result } = renderHook(
      () => useJob({ initialJobId: 'browser-123' }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(fetchCloudDesign).not.toHaveBeenCalled()
  })
})

describe('deleting from the cloud', () => {
  beforeEach(() => {
    useJobHistory.getState().upsertEntry({
      id: ID,
      status: 'completed',
      result: RESULT,
      formValues: VALUES,
      cloudId: ID,
    })
  })

  it('deletes the cloud copy and keeps this browser’s', async () => {
    vi.mocked(deleteCloudDesign).mockResolvedValue({ ok: true, data: null })
    const { result } = renderHook(() => useJob({ initialJobId: ID }), {
      wrapper,
    })

    await act(async () => {
      await result.current.deleteFromCloud()
    })

    expect(deleteCloudDesign).toHaveBeenCalledWith(ID)
    expect(useJobHistory.getState().getEntry(ID)).toMatchObject({
      status: 'completed',
      cloudDeleted: true,
      result: RESULT,
    })
    expect(result.current.cloud?.deleted).toBe(true)
  })

  it('leaves everything as it was when the cloud refuses (not the owner)', async () => {
    vi.mocked(deleteCloudDesign).mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Only the person who submitted a cloud design can delete it.',
    })
    const { result } = renderHook(() => useJob({ initialJobId: ID }), {
      wrapper,
    })

    await act(async () => {
      await result.current.deleteFromCloud()
    })

    expect(useJobHistory.getState().getEntry(ID)?.cloudDeleted).toBeUndefined()
  })
})

describe('history', () => {
  it('never sweeps a running cloud design as abandoned', async () => {
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    await useJobHistory.persist
      .getOptions()
      .storage?.setItem('rej-studio:job-history', {
        version: 0,
        state: {
          entries: [
            {
              id: ID,
              name: 'Cloud run',
              sequenceLength: 96,
              createdAt: old,
              status: 'running',
              result: null,
              error: null,
              cloudId: ID,
            },
            {
              id: 'browser-old',
              name: 'Browser run',
              sequenceLength: 96,
              createdAt: old,
              status: 'running',
              result: null,
              error: null,
            },
          ],
        },
      })
    await useJobHistory.persist.rehydrate()
    expect(useJobHistory.getState().entries.map((e) => e.id)).toEqual([ID])
  })
})
