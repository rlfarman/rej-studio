import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
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

// The corpus the hook searches: a stub by default, so each test controls
// what a search returns; the last tests use the committed sample.
const { mockGetBrowserCorpus } = vi.hoisted(() => ({
  mockGetBrowserCorpus: vi.fn(),
}))
vi.mock('../corpus/gene-data-url', () => ({
  getBrowserCorpus: mockGetBrowserCorpus,
}))

import { useGeneSearch } from './use-gene-search'
import { sampleCorpus } from '../corpus/test-utils'

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function createWrapper(client = createClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
  return Wrapper
}

function page(results: unknown[] = [], truncated = false) {
  return { results, truncated }
}

/** The (query, species, limit) of the nth corpus search (0-based). */
const searchCall = (n: number) => mockSearch.mock.calls[n]

const mockSearch = vi.fn()
const mockSimilar = vi.fn()
const mockFetch = vi.fn()
const gene = { id: '1', symbol: 'BRCA1', name: 'BRCA1', species: 'human' }

describe('useGeneSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBrowserCorpus.mockReturnValue({
      searchGenes: mockSearch,
      similarGenes: mockSimilar,
    })
    speciesRef.current = 'both'
    mockSearch.mockImplementation(async () => page())
    mockSimilar.mockResolvedValue([])
    // Searching never goes over the network once the index is in.
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
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('does not search for whitespace-only query', async () => {
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: '   ' }),
      { wrapper: createWrapper() },
    )
    // Wait a tick to ensure debounce fires
    await new Promise((r) => setTimeout(r, 300))
    expect(mockSearch).not.toHaveBeenCalled()
    expect(result.current.hasSearched).toBe(false)
  })

  // --- Request ---

  it('searches the corpus with query, species and the palette limit', async () => {
    speciesRef.current = 'mouse'
    mockSearch.mockResolvedValue(page([gene]))

    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(result.current.searchResults).toEqual([gene])
    expect(searchCall(0)).toEqual(['BRCA1', 'mouse', 6])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('exposes truncation, and suggestions when nothing matched', async () => {
    mockSearch.mockResolvedValue(page([], true))
    mockSimilar.mockResolvedValue([{ symbol: 'BRCA1', species: 'human' }])
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

    await waitFor(() => expect(mockSearch).toHaveBeenCalled())
    expect(mockSearch).toHaveBeenCalledTimes(1)
    expect(searchCall(0)[0]).toBe('BRCA')
  })

  // --- Pending state ---

  it('reports loading during the debounce window, before any request', () => {
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })
    act(() => result.current.setQuery('TP53'))

    expect(mockSearch).not.toHaveBeenCalled()
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
    await waitFor(() => expect(mockSearch).toHaveBeenCalled(), {
      timeout: 100,
    })
    expect(searchCall(0)[0]).toBe('TP53')
  })

  it("doesn't count the previous query's results as searched", async () => {
    const tp53 = { id: '1', symbol: 'TP53', name: 'TP53', species: 'human' }
    mockSearch.mockResolvedValueOnce(page([tp53]))
    const { result } = renderHook(() => useGeneSearch(), {
      wrapper: createWrapper(),
    })
    act(() => result.current.searchNow('TP53'))
    await waitFor(() => expect(result.current.hasSearched).toBe(true))

    // Next query never resolves, so the previous results stay as placeholder.
    mockSearch.mockReturnValueOnce(new Promise(() => {}))
    act(() => result.current.searchNow('KRAS'))
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2))

    expect(result.current.searchResults).toEqual([tp53])
    expect(result.current.hasSearched).toBe(false)
    expect(result.current.isLoading).toBe(true)
  })

  // --- Cache behavior ---

  it('uses cached results on second render with same query', async () => {
    mockSearch.mockImplementation(async () => page([gene]))
    const client = createClient()

    const { result, unmount } = renderHook(
      () => useGeneSearch({ defaultQuery: 'TP53' }),
      { wrapper: createWrapper(client) },
    )
    await waitFor(() => expect(result.current.hasSearched).toBe(true))
    expect(mockSearch).toHaveBeenCalledTimes(1)
    unmount()

    const { result: result2 } = renderHook(
      () => useGeneSearch({ defaultQuery: 'TP53' }),
      { wrapper: createWrapper(client) },
    )
    await waitFor(() => expect(result2.current.hasSearched).toBe(true))
    expect(result2.current.searchResults).toEqual([gene])
    expect(mockSearch).toHaveBeenCalledTimes(1)
  })

  // --- Error handling ---

  it('shows a generic message when the index fails to load', async () => {
    mockSearch.mockRejectedValue(new Error('Gene data index.json: HTTP 503'))
    const { result } = renderHook(
      () => useGeneSearch({ defaultQuery: 'BRCA1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => {
      expect(result.current.error).toBe('Search failed. Please try again.')
    })
    expect(result.current.searchResults).toEqual([])
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
    expect(mockSearch).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.retry()
    })
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2))
  })

  // --- In-browser search (static corpus) ---

  describe('with the committed sample corpus', () => {
    beforeEach(() => {
      mockGetBrowserCorpus.mockReturnValue(sampleCorpus())
    })

    it('ranks matches across species', async () => {
      const { result } = renderHook(
        () => useGeneSearch({ defaultQuery: 'brca' }),
        { wrapper: createWrapper() },
      )
      await waitFor(() => expect(result.current.hasSearched).toBe(true))
      expect(
        result.current.searchResults.map((g) => `${g.symbol}/${g.species}`),
      ).toEqual(['BRCA1/human', 'BRCA2/human', 'BRCA1/mouse', 'BRCA2/mouse'])
      expect(result.current.error).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('applies the species filter and suggests similar symbols', async () => {
      speciesRef.current = 'mouse'
      const { result } = renderHook(
        () => useGeneSearch({ defaultQuery: 'BRCA3' }),
        { wrapper: createWrapper() },
      )
      await waitFor(() => expect(result.current.hasSearched).toBe(true))
      expect(result.current.searchResults).toEqual([])
      expect(result.current.suggestions[0]).toEqual({
        symbol: 'BRCA1',
        species: 'human',
      })
    })
  })
})
