import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

const loadIndex = vi.hoisted(() => vi.fn())
vi.mock('../corpus/gene-data-url', () => ({
  getBrowserCorpus: () => ({ loadIndex }),
}))

import { usePrefetchGeneIndex } from './use-prefetch-gene-index'

afterEach(() => {
  vi.useRealTimers()
  loadIndex.mockReset()
})

describe('usePrefetchGeneIndex', () => {
  it('loads the index when idle, then warms it in a later idle slot', async () => {
    vi.useFakeTimers()
    const warm = vi.fn()
    loadIndex.mockResolvedValue({ warm })
    renderHook(() => usePrefetchGeneIndex())
    expect(loadIndex).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()
    expect(loadIndex).toHaveBeenCalledTimes(1)
    expect(warm).toHaveBeenCalledTimes(1)
  })

  it('does nothing once unmounted before the page is idle', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => usePrefetchGeneIndex())
    unmount()
    await vi.runAllTimersAsync()
    expect(loadIndex).not.toHaveBeenCalled()
  })

  it('swallows a failed download, leaving it to the next search', async () => {
    vi.useFakeTimers()
    loadIndex.mockRejectedValue(new Error('offline'))
    renderHook(() => usePrefetchGeneIndex())
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow()
    expect(loadIndex).toHaveBeenCalledTimes(1)
  })
})
