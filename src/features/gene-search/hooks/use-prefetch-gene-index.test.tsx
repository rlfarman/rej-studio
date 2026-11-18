import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

const prefetchGeneIndex = vi.hoisted(() => vi.fn())
vi.mock('../api/search-worker-client', () => ({ prefetchGeneIndex }))

import { usePrefetchGeneIndex } from './use-prefetch-gene-index'

afterEach(() => {
  vi.useRealTimers()
  prefetchGeneIndex.mockReset()
})

describe('usePrefetchGeneIndex', () => {
  it('starts the download once the page is idle', async () => {
    vi.useFakeTimers()
    prefetchGeneIndex.mockResolvedValue(undefined)
    renderHook(() => usePrefetchGeneIndex())
    expect(prefetchGeneIndex).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(prefetchGeneIndex).toHaveBeenCalledTimes(1)
  })

  it('does nothing once unmounted before the page is idle', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => usePrefetchGeneIndex())
    unmount()
    await vi.runAllTimersAsync()
    expect(prefetchGeneIndex).not.toHaveBeenCalled()
  })

  it('swallows a failed download, leaving it to the next search', async () => {
    vi.useFakeTimers()
    prefetchGeneIndex.mockRejectedValue(new Error('offline'))
    renderHook(() => usePrefetchGeneIndex())
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow()
    expect(prefetchGeneIndex).toHaveBeenCalledTimes(1)
  })
})
