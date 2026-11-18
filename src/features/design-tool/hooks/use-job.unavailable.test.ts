// Opening a `?job=` that resolves to nothing. There are three ways that
// happens and they need three different answers, so the id is read rather
// than one "No longer available" standing in for all of them.

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/features/design-tool/api/cloud-designs', () => ({
  submitCloudDesign: vi.fn(),
  fetchCloudDesign: vi.fn(),
  deleteCloudDesign: vi.fn(),
  myCloudDesignsQuery: { queryKey: ['account', 'cloud-designs'] },
}))
vi.mock('@/features/design-tool/api/browser-optimizer', () => ({
  browserOptimizerSupported: vi.fn(() => true),
  designInBrowser: vi.fn(),
  warmOptimizerWorker: vi.fn(),
  registerBrowserRun: vi.fn(() => () => {}),
}))
vi.mock('@/features/design-tool/utils/cloud-runs', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/design-tool/utils/cloud-runs')
  >()),
  cloudRuns: { start: vi.fn(), wake: vi.fn(), stop: vi.fn() },
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { fetchCloudDesign } from '@/features/design-tool/api/cloud-designs'
import { designToolCopy } from '@/features/design-tool/copy'
import {
  useJobHistory,
  whenJobHistoryHydrated,
} from '@/features/design-tool/hooks/use-job-history'
import { useJob } from './use-job'

let client: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children)
}

beforeEach(async () => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  vi.clearAllMocks()
  await whenJobHistoryHydrated()
  useJobHistory.setState({ entries: [], progressById: {} })
})

async function errorFor(initialJobId: string) {
  const { result } = renderHook(() => useJob({ initialJobId }), { wrapper })
  await waitFor(() => expect(result.current.status).toBe('failed'))
  return result.current.error
}

describe('a design that is not here', () => {
  it('says a browser design stays on the device that ran it', async () => {
    const error = await errorFor('browser-made-somewhere-else')

    expect(error?.code).toBe('not_found')
    expect(error?.message).toBe(designToolCopy.jobErrors.notFoundBrowser)
    expect(error?.retriable).toBe(false)
  })

  it('says a cloud design was deleted or aged out', async () => {
    vi.mocked(fetchCloudDesign).mockResolvedValue({
      ok: false,
      status: 404,
      message: 'gone',
    })

    const error = await errorFor('d'.repeat(64))

    expect(error?.message).toBe(designToolCopy.jobErrors.notFoundCloud)
  })

  it('falls back to the link itself for an id of no known shape', async () => {
    const error = await errorFor('not-an-id')

    expect(error?.message).toBe(designToolCopy.jobErrors.notFound)
  })

  it('does not call a cloud it could not reach a missing design', async () => {
    vi.mocked(fetchCloudDesign).mockResolvedValue({
      ok: false,
      status: 503,
      message: 'Could not reach the cloud.',
    })

    const error = await errorFor('e'.repeat(64))

    expect(error?.code).toBe('backend')
    expect(error?.message).toBe('Could not reach the cloud.')
  })
})
