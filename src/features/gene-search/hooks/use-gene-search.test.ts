import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

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

const { mockTrackEvent } = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
}))
vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}))

const { mockSearchGenesClient } = vi.hoisted(() => ({
  mockSearchGenesClient: vi.fn(),
}))
vi.mock('@/features/gene-search/utils/client-search', () => ({
  searchGenesClient: mockSearchGenesClient,
}))

import { useGeneSearch } from './use-gene-search'

describe('useGeneSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    speciesRef.current = 'both'
    mockSearchGenesClient.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty results for empty query', () => {
    const { result } = renderHook(() => useGeneSearch())
    expect(result.current.searchResults).toEqual([])
    expect(result.current.hasSearched).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(mockSearchGenesClient).not.toHaveBeenCalled()
  })

  it('does not fetch for whitespace-only query', async () => {
    renderHook(() => useGeneSearch({ defaultQuery: '   ' }))
    await new Promise((r) => setTimeout(r, 300))
    expect(mockSearchGenesClient).not.toHaveBeenCalled()
  })

  it('fires search after debounce for non-empty query', async () => {
    const gene = { id: '1', symbol: 'BRCA1', name: 'BRCA1', species: 'human' }
    mockSearchGenesClient.mockResolvedValue([gene])

    const { result } = renderHook(() =>
      useGeneSearch({ defaultQuery: 'BRCA1' }),
    )

    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(result.current.searchResults).toEqual([gene])
    expect(mockSearchGenesClient).toHaveBeenCalledWith('BRCA1', 'both')
  })

  it('setQuery updates the query value', () => {
    const { result } = renderHook(() => useGeneSearch())
    act(() => result.current.setQuery('TP53'))
    expect(result.current.query).toBe('TP53')
  })

  it('shows error when client search throws', async () => {
    mockSearchGenesClient.mockRejectedValue(new Error('boom'))
    // Silence the console.error from the hook's catch.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useGeneSearch({ defaultQuery: 'BRCA1' }),
    )
    await waitFor(() =>
      expect(result.current.error).toBe('Search is temporarily unavailable.'),
    )
    spy.mockRestore()
  })

  it('returns null error for successful empty results', async () => {
    mockSearchGenesClient.mockResolvedValue([])
    const { result } = renderHook(() =>
      useGeneSearch({ defaultQuery: 'NONEXISTENT' }),
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(result.current.error).toBeNull()
    expect(result.current.searchResults).toEqual([])
  })

  it('retry refetches', async () => {
    const { result } = renderHook(() =>
      useGeneSearch({ defaultQuery: 'BRCA1' }),
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(mockSearchGenesClient).toHaveBeenCalledTimes(1)
    act(() => result.current.retry())
    await waitFor(() => expect(mockSearchGenesClient).toHaveBeenCalledTimes(2))
  })

  it('tracks search event once per unique query', async () => {
    const gene = { id: '1', symbol: 'BRCA1', name: 'BRCA1', species: 'human' }
    mockSearchGenesClient.mockResolvedValue([gene])
    const { result } = renderHook(() =>
      useGeneSearch({ defaultQuery: 'BRCA1' }),
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'gene_search',
        query: 'BRCA1',
        result_count: 1,
      }),
    )
    const searchEvents = mockTrackEvent.mock.calls.filter(
      (c: any[]) => c[0]?.event === 'gene_search',
    )
    expect(searchEvents).toHaveLength(1)
  })
})
