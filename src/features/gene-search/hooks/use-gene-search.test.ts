import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// Mock species context — use a mutable ref so tests can change species
const speciesRef = { current: 'both' as string }
vi.mock('@/stores/species-store', () => ({
  useSpeciesStore: Object.assign(
    (selector: (s: any) => any) =>
      selector({
        species: speciesRef.current,
        handleSpeciesChange: vi.fn(),
      }),
    {
      getState: () => ({
        species: speciesRef.current,
        handleSpeciesChange: vi.fn(),
      }),
    },
  ),
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

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
  return Wrapper
}

describe('useGeneSearch', () => {
  const mockSearchGenes = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    speciesRef.current = 'both'
    mockSearchGenes.mockResolvedValue({ results: [] })
  })

  // --- Basic behavior ---

  it('returns empty results for empty query', () => {
    const { result } = renderHook(
      () => useGeneSearch({ searchGenes: mockSearchGenes }),
      { wrapper: createWrapper() },
    )
    expect(result.current.searchResults).toEqual([])
    expect(result.current.hasSearched).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(mockSearchGenes).not.toHaveBeenCalled()
  })

  it('does not fetch for whitespace-only query', async () => {
    const { result } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: '   ',
        }),
      { wrapper: createWrapper() },
    )
    // Wait a tick to ensure debounce fires
    await new Promise((r) => setTimeout(r, 300))
    expect(mockSearchGenes).not.toHaveBeenCalled()
    expect(result.current.hasSearched).toBe(false)
  })

  // --- Query + debounce ---

  it('fires search after debounce for non-empty query', async () => {
    const gene = {
      id: '1',
      symbol: 'BRCA1',
      name: 'BRCA1',
      species: 'human',
    }
    mockSearchGenes.mockResolvedValue({ results: [gene] })

    const { result } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: 'BRCA1',
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.hasSearched).toBe(true)
    })
    expect(result.current.searchResults).toEqual([gene])
    expect(mockSearchGenes).toHaveBeenCalledWith('BRCA1', 'both')
  })

  it('setQuery updates the query value', () => {
    const { result } = renderHook(
      () => useGeneSearch({ searchGenes: mockSearchGenes }),
      { wrapper: createWrapper() },
    )
    act(() => {
      result.current.setQuery('TP53')
    })
    expect(result.current.query).toBe('TP53')
  })

  it('debounces rapid query changes — only last value fires', async () => {
    const { result } = renderHook(
      () => useGeneSearch({ searchGenes: mockSearchGenes }),
      { wrapper: createWrapper() },
    )

    // Type rapidly
    act(() => result.current.setQuery('B'))
    act(() => result.current.setQuery('BR'))
    act(() => result.current.setQuery('BRC'))
    act(() => result.current.setQuery('BRCA'))

    // Wait for debounce (250ms) + query to complete
    mockSearchGenes.mockResolvedValue({ results: [] })
    await waitFor(() => {
      expect(mockSearchGenes).toHaveBeenCalled()
    })

    // Should have been called with the final debounced value
    const lastCall =
      mockSearchGenes.mock.calls[mockSearchGenes.mock.calls.length - 1]
    expect(lastCall[0]).toBe('BRCA')
  })

  // --- Cache behavior ---

  it('uses cached results on second render with same query', async () => {
    const gene = {
      id: '1',
      symbol: 'TP53',
      name: 'TP53',
      species: 'human',
    }
    mockSearchGenes.mockResolvedValue({ results: [gene] })

    // Share a single QueryClient across both renders
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client }, children)
    }

    const { result, unmount } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: 'TP53',
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(mockSearchGenes).toHaveBeenCalledTimes(1)
    unmount()

    // Re-render with same query and client — should hit cache
    const { result: result2 } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: 'TP53',
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result2.current.hasSearched).toBe(true))
    expect(result2.current.searchResults).toEqual([gene])
    // searchGenes should NOT have been called again (cache hit)
    expect(mockSearchGenes).toHaveBeenCalledTimes(1)
  })

  // --- Error handling ---

  it('shows network error message on rejected promise', async () => {
    mockSearchGenes.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: 'BRCA1',
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Search failed. Please try again.')
    })
  })

  it('shows server error from data.error field', async () => {
    mockSearchGenes.mockResolvedValue({
      results: [],
      error: 'Search is temporarily unavailable.',
    })

    const { result } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: 'BRCA1',
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Search is temporarily unavailable.')
    })
  })

  it('returns null error for successful empty results', async () => {
    mockSearchGenes.mockResolvedValue({ results: [] })

    const { result } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: 'NONEXISTENT',
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(result.current.error).toBeNull()
    expect(result.current.searchResults).toEqual([])
  })

  // --- Retry ---

  it('retry invalidates cache and refetches', async () => {
    mockSearchGenes.mockResolvedValue({ results: [] })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client }, children)
    }

    const { result } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: 'BRCA1',
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(mockSearchGenes).toHaveBeenCalledTimes(1)

    // Call retry
    act(() => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(mockSearchGenes).toHaveBeenCalledTimes(2)
    })
  })

  // --- Analytics ---

  it('tracks search event once per unique query', async () => {
    const gene = {
      id: '1',
      symbol: 'BRCA1',
      name: 'BRCA1',
      species: 'human',
    }
    mockSearchGenes.mockResolvedValue({ results: [gene] })

    const { result } = renderHook(
      () =>
        useGeneSearch({
          searchGenes: mockSearchGenes,
          defaultQuery: 'BRCA1',
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.hasSearched).toBe(true))

    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'gene_search',
        query: 'BRCA1',
        result_count: 1,
      }),
    )
    // Should fire exactly once
    const searchEvents = mockTrackEvent.mock.calls.filter(
      (c: any[]) => c[0]?.event === 'gene_search',
    )
    expect(searchEvents).toHaveLength(1)
  })
})
