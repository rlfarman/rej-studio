import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// Mock species context — use a mutable ref so tests can change species
const speciesRef = { current: 'both' as string }
vi.mock('@/stores/species-store', () => ({
  useSpeciesContext: () => ({
    species: speciesRef.current,
    handleSpeciesChange: vi.fn(),
  }),
}))

// Track analytics calls
const { mockTrackEvent } = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
}))
vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}))

import { useGeneSearch } from './use-gene-search'

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function createWrapper(client = createClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
  return Wrapper
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function okBody(results: unknown[] = [], extra: object = {}) {
  return { results, truncated: false, suggestions: [], ...extra }
}

/** The search params of the nth fetch call (0-based). */
function requestParams(n: number): Record<string, string> {
  const url = new URL(String(mockFetch.mock.calls[n][0]), 'http://localhost')
  return { path: url.pathname, ...Object.fromEntries(url.searchParams) }
}

const mockFetch = vi.fn()
const gene = { id: '1', symbol: 'BRCA1', name: 'BRCA1', species: 'human' }

describe('useGeneSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    speciesRef.current = 'both'
    mockFetch.mockImplementation(async () => jsonResponse(okBody()))
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // --- Basic behavior ---

  it('returns empty results for empty query', () => {
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })
    expect(result.current.searchResults).toEqual([])
    expect(result.current.hasSearched).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not fetch for whitespace-only query', async () => {
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: '   ' }),
      { wrapper: createWrapper() },
    )
    // Wait a tick to ensure debounce fires
    await new Promise((r) => setTimeout(r, 300))
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.hasSearched).toBe(false)
  })

  // --- Request ---

  it('GETs the search route with query, species and the palette limit', async () => {
    speciesRef.current = 'mouse'
    mockFetch.mockResolvedValue(jsonResponse(okBody([gene])))

    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(result.current.searchResults).toEqual([gene])
    expect(requestParams(0)).toEqual({
      path: '/api/genes/search',
      q: 'BRCA1',
      species: 'mouse',
      limit: '6',
    })
    const init = mockFetch.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('exposes truncation and suggestions from the response', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(
        okBody([], {
          truncated: true,
          suggestions: [{ symbol: 'BRCA1', species: 'human' }],
        }),
      ),
    )
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRAC1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(result.current.truncated).toBe(true)
    expect(result.current.suggestions).toEqual([
      { symbol: 'BRCA1', species: 'human' },
    ])
  })

  it('aborts the previous request when the query changes', async () => {
    const signals: AbortSignal[] = []
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          signals.push(init.signal!)
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.searchNow('TP53'))
    await waitFor(() => expect(signals).toHaveLength(1))
    act(() => result.current.searchNow('KRAS'))
    await waitFor(() => expect(signals).toHaveLength(2))

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  // --- Query + debounce ---

  it('setQuery updates the query value', () => {
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })
    act(() => {
      result.current.setQuery('TP53')
    })
    expect(result.current.query).toBe('TP53')
  })

  it('debounces rapid query changes — only last value fires', async () => {
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setQuery('B'))
    act(() => result.current.setQuery('BR'))
    act(() => result.current.setQuery('BRC'))
    act(() => result.current.setQuery('BRCA'))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(requestParams(0).q).toBe('BRCA')
  })

  // --- Pending state ---

  it('reports loading during the debounce window, before any request', () => {
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })
    act(() => result.current.setQuery('TP53'))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasSearched).toBe(false)
  })

  it('searchNow skips the debounce', async () => {
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })
    act(() => result.current.searchNow('TP53'))

    expect(result.current.query).toBe('TP53')
    // Well inside the 250ms debounce.
    await waitFor(() => expect(mockFetch).toHaveBeenCalled(), {
      timeout: 100,
    })
    expect(requestParams(0).q).toBe('TP53')
  })

  it("doesn't count the previous query's results as searched", async () => {
    const tp53 = { id: '1', symbol: 'TP53', name: 'TP53', species: 'human' }
    mockFetch.mockResolvedValueOnce(jsonResponse(okBody([tp53])))
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })
    act(() => result.current.searchNow('TP53'))
    await waitFor(() => expect(result.current.hasSearched).toBe(true))

    // Next query never resolves, so the previous results stay as placeholder.
    mockFetch.mockReturnValueOnce(new Promise(() => {}))
    act(() => result.current.searchNow('KRAS'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))

    expect(result.current.searchResults).toEqual([tp53])
    expect(result.current.hasSearched).toBe(false)
    expect(result.current.isLoading).toBe(true)
  })

  // --- Cache behavior ---

  it('uses cached results on second render with same query', async () => {
    mockFetch.mockImplementation(async () => jsonResponse(okBody([gene])))
    const client = createClient()

    const { result, unmount } = renderHook(
      () => useGeneSearch({ defaultQuery: 'TP53' }),
      { wrapper: createWrapper(client) },
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(mockFetch).toHaveBeenCalledTimes(1)
    unmount()

    const { result: result2 } = renderHook(
      () => useGeneSearch({ defaultQuery: 'TP53' }),
      { wrapper: createWrapper(client) },
    )
    await waitFor(() => expect(result2.current.hasSearched).toBe(true))
    expect(result2.current.searchResults).toEqual([gene])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // --- Error handling ---

  it('shows a generic message when the network request fails', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => {
      expect(result.current.error).toBe('Search failed. Please try again.')
    })
  })

  it.each([
    [429, 'Too many searches. Try again in 12s.'],
    [503, 'Search is temporarily unavailable.'],
    [401, 'Your session has expired. Sign in again to search.'],
  ])('shows the server message for a %i', async (status, message) => {
    mockFetch.mockResolvedValue(jsonResponse({ error: message }, status))
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.error).toBe(message))
    expect(result.current.searchResults).toEqual([])
  })

  it('falls back to the generic message for a non-JSON error', async () => {
    mockFetch.mockResolvedValue(new Response('Bad Gateway', { status: 502 }))
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() =>
      expect(result.current.error).toBe('Search failed. Please try again.'),
    )
  })

  it('returns null error for successful empty results', async () => {
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'NONEXISTENT' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(result.current.error).toBeNull()
    expect(result.current.searchResults).toEqual([])
  })

  // --- Retry ---

  it('retry invalidates cache and refetches', async () => {
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(mockFetch).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.retry()
    })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
  })

  // --- Analytics ---

  it('tracks search event once per unique query', async () => {
    mockFetch.mockImplementation(async () => jsonResponse(okBody([gene])))
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))

    const searchEvents = mockTrackEvent.mock.calls.filter(
      (c: any[]) => c[0]?.event === 'gene_search',
    )
    expect(searchEvents).toHaveLength(1)
    expect(searchEvents[0][0]).toEqual(
      expect.objectContaining({ query: 'BRCA1', result_count: 1 }),
    )
  })

  it("doesn't track a failed search", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'down' }, 503))
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.error).toBe('down'))
    expect(
      mockTrackEvent.mock.calls.some((c) => c[0]?.event === 'gene_search'),
    ).toBe(false)
  })
})
