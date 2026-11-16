import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the query layer (tested separately in DB integration tests)
vi.mock('@/features/gene-search/api/gene-queries', () => ({
  fetchGenesBySearch: vi.fn(),
  fetchGeneBySymbol: vi.fn(),
  fetchSimilarGenes: vi.fn(),
}))

const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn() }))
// Keying (session vs IP) is tested in src/lib/client-ip.test.ts.
vi.mock('@/lib/client-ip', () => ({
  getRequestRateLimitKey: vi.fn(async () => 'ip:127.0.0.1'),
}))
vi.mock('@/lib/upstash', () => ({
  createUpstashRateLimiter: () => ({ check: mockCheck }),
  redis: null,
}))

import {
  fetchGenesBySearch,
  fetchGeneBySymbol,
  fetchSimilarGenes,
} from '@/features/gene-search/api/gene-queries'
import {
  checkSearchRateLimit,
  findSimilarGenes,
  getGeneBySymbol,
  searchGenes,
  SearchUnavailableError,
} from './genes'

const mockFetchBySearch = vi.mocked(fetchGenesBySearch)
const mockFetchBySymbol = vi.mocked(fetchGeneBySymbol)
const mockFetchSimilar = vi.mocked(fetchSimilarGenes)

const gene = { id: 'ENSG1', symbol: 'BRCA1', name: 'BRCA1', species: 'human' }

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchBySearch.mockResolvedValue({ results: [], truncated: false })
  mockFetchBySymbol.mockResolvedValue(null as never)
  mockFetchSimilar.mockResolvedValue([])
  mockCheck.mockResolvedValue({ ok: true, remaining: 29, resetMs: 60_000 })
})

describe('searchGenes', () => {
  const request = { q: 'BRCA1', species: 'both', limit: 6 } as const

  it('returns results, the truncated flag, and no suggestions', async () => {
    mockFetchBySearch.mockResolvedValue({ results: [gene], truncated: true })
    const result = await searchGenes(request)
    expect(result).toEqual({
      results: [gene],
      truncated: true,
      suggestions: [],
    })
    expect(mockFetchBySearch).toHaveBeenCalledWith('BRCA1', 'both', 6)
    expect(mockFetchSimilar).not.toHaveBeenCalled()
  })

  it('trims the query before searching', async () => {
    await searchGenes({ ...request, q: '  BRCA1  ', species: 'human' })
    expect(mockFetchBySearch).toHaveBeenCalledWith('BRCA1', 'human', 6)
  })

  it('returns empty for a whitespace-only query without calling the DB', async () => {
    const result = await searchGenes({ ...request, q: '   ' })
    expect(result.results).toEqual([])
    expect(mockFetchBySearch).not.toHaveBeenCalled()
  })

  it('suggests similar symbols when nothing matched', async () => {
    mockFetchSimilar.mockResolvedValue([{ symbol: 'BRCA1', species: 'human' }])
    const result = await searchGenes({ ...request, q: 'BRAC1' })
    expect(mockFetchSimilar).toHaveBeenCalledWith('brac1')
    expect(result.suggestions).toEqual([{ symbol: 'BRCA1', species: 'human' }])
  })

  it("doesn't suggest symbols for a phrase", async () => {
    await searchGenes({ ...request, q: 'cystic fibrosis' })
    expect(mockFetchSimilar).not.toHaveBeenCalled()
  })

  it('throws SearchUnavailableError on DB failure', async () => {
    mockFetchBySearch.mockRejectedValue(new Error('DB down'))
    await expect(searchGenes(request)).rejects.toBeInstanceOf(
      SearchUnavailableError,
    )
  })
})

describe('checkSearchRateLimit', () => {
  it('allows a request within budget', async () => {
    expect(await checkSearchRateLimit()).toEqual({ ok: true })
    expect(mockCheck).toHaveBeenCalledWith('ip:127.0.0.1')
  })

  it('reports seconds until reset when over budget', async () => {
    mockCheck.mockResolvedValue({ ok: false, remaining: 0, resetMs: 4_200 })
    expect(await checkSearchRateLimit()).toEqual({
      ok: false,
      retryAfterSeconds: 5,
    })
  })
})

describe('getGeneBySymbol', () => {
  it('returns gene for valid symbol', async () => {
    mockFetchBySymbol.mockResolvedValue(gene)
    expect(await getGeneBySymbol('brca1')).toEqual(gene)
    expect(mockFetchBySymbol).toHaveBeenCalledWith('brca1', undefined)
  })

  it('rejects empty symbol', async () => {
    await expect(getGeneBySymbol('')).rejects.toThrow()
  })

  it('rejects symbol over 100 chars', async () => {
    await expect(getGeneBySymbol('A'.repeat(101))).rejects.toThrow()
  })
})

describe('findSimilarGenes', () => {
  it('returns results', async () => {
    mockFetchSimilar.mockResolvedValue([{ symbol: 'BRCA1', species: 'human' }])
    const result = await findSimilarGenes('BRCA')
    expect(result).toEqual([{ symbol: 'BRCA1', species: 'human' }])
  })

  it('returns empty for empty input', async () => {
    const result = await findSimilarGenes('')
    expect(result).toEqual([])
    expect(mockFetchSimilar).not.toHaveBeenCalled()
  })

  it('returns empty on error', async () => {
    mockFetchSimilar.mockRejectedValue(new Error('fail'))
    const result = await findSimilarGenes('BRCA')
    expect(result).toEqual([])
  })

  it('lowercases and truncates input to 20 chars', async () => {
    await findSimilarGenes('A'.repeat(30))
    expect(mockFetchSimilar).toHaveBeenCalledWith('a'.repeat(20))
  })
})
