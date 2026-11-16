import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useIsMobile } from './use-mobile'

type Listener = () => void

function mockViewport(width: number) {
  const listeners = new Set<Listener>()
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    })),
  )
  return {
    resize(next: number) {
      vi.stubGlobal('innerWidth', next)
      listeners.forEach((l) => l())
    },
    listeners,
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useIsMobile', () => {
  it('reports the current viewport', () => {
    mockViewport(500)
    expect(renderHook(() => useIsMobile()).result.current).toBe(true)
  })

  it('updates when the media query changes, and unsubscribes on unmount', () => {
    const viewport = mockViewport(1024)
    const { result, unmount } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => viewport.resize(600))
    expect(result.current).toBe(true)

    unmount()
    expect(viewport.listeners.size).toBe(0)
  })
})
