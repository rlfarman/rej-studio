import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useMediaQuery } from './use-media-query'

type Listener = () => void

function mockMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<Listener>()
  const matchMedia = vi.fn((_query: string) => ({
    get matches() {
      return matches
    },
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }))
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    matchMedia,
    listeners,
    set(next: boolean) {
      matches = next
      listeners.forEach((l) => l())
    },
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useMediaQuery', () => {
  it('reports whether the query matches', () => {
    const media = mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(pointer: fine)'))
    expect(result.current).toBe(true)
    expect(media.matchMedia).toHaveBeenCalledWith('(pointer: fine)')
  })

  it('follows changes and unsubscribes on unmount', () => {
    const media = mockMatchMedia(false)
    const { result, unmount } = renderHook(() => useMediaQuery('(x)'))
    expect(result.current).toBe(false)

    act(() => media.set(true))
    expect(result.current).toBe(true)

    unmount()
    expect(media.listeners.size).toBe(0)
  })

  it('is false where matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(renderHook(() => useMediaQuery('(x)')).result.current).toBe(false)
  })
})
