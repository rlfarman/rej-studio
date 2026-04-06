import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// Mock species context
vi.mock('@/stores/species-store', () => ({
  useSpeciesStore: Object.assign(
    (selector: (s: any) => any) =>
      selector({ species: 'both', handleSpeciesChange: vi.fn() }),
    { getState: () => ({ species: 'both', handleSpeciesChange: vi.fn() }) },
  ),
  useSpeciesContext: () => ({ species: 'both', handleSpeciesChange: vi.fn() }),
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
    mockSearchGenes.mockResolvedValue({ results: [] })
  })

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

  it('fires search after debounce for non-empty query', async () => {
    const gene = { id: '1', symbol: 'BRCA1', name: 'BRCA1', species: 'human' }
    mockSearchGenes.mockResolvedValue({ results: [gene] })

    const { result } = renderHook(
      () =>
        useGeneSearch({ searchGenes: mockSearchGenes, defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.hasSearched).toBe(true)
    })
    expect(result.current.searchResults).toEqual([gene])
    expect(mockSearchGenes).toHaveBeenCalledWith('BRCA1', 'both')
  })

  it('shows error on network failure', async () => {
    mockSearchGenes.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(
      () =>
        useGeneSearch({ searchGenes: mockSearchGenes, defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Search failed. Please try again.')
    })
  })

  it('shows server error from response', async () => {
    mockSearchGenes.mockResolvedValue({
      results: [],
      error: 'Search is temporarily unavailable.',
    })

    const { result } = renderHook(
      () =>
        useGeneSearch({ searchGenes: mockSearchGenes, defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Search is temporarily unavailable.')
    })
  })

  it('setQuery updates the query', async () => {
    const { result } = renderHook(
      () => useGeneSearch({ searchGenes: mockSearchGenes }),
      { wrapper: createWrapper() },
    )
    act(() => {
      result.current.setQuery('TP53')
    })
    expect(result.current.query).toBe('TP53')
  })
})
