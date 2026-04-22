import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the query layer (tested separately in DB integration tests)
vi.mock('@/features/gene-search/api/gene-queries', () => ({
  fetchGenesBySearch: vi.fn(),
  fetchGeneBySymbol: vi.fn(),
  fetchSimilarGenes: vi.fn(),
}))

// Mock rate limiter to allow all by default
vi.mock('@/lib/upstash', () => ({
  createUpstashRateLimiter: () => ({
    check: vi.fn(async () => ({ ok: true, remaining: 29, resetMs: 60000 })),
  }),
  redis: null,
}))

import {
  fetchGenesBySearch,
  fetchGeneBySymbol,
  fetchSimilarGenes,
} from '@/features/gene-search/api/gene-queries'
import { searchGenes, getGeneBySymbol, findSimilarGenes } from './genes'

const mockFetchBySearch = vi.mocked(fetchGenesBySearch)
const mockFetchBySymbol = vi.mocked(fetchGeneBySymbol)
const mockFetchSimilar = vi.mocked(fetchSimilarGenes)

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchBySearch.mockResolvedValue([])
  mockFetchBySymbol.mockResolvedValue(null as any)
  mockFetchSimilar.mockResolvedValue([])
})

describe('searchGenes', () => {
  it('returns results for valid query', async () => {
    const gene = {
      id: 'ENSG1',
      symbol: 'BRCA1',
      name: 'BRCA1',
      species: 'human',
    }
    mockFetchBySearch.mockResolvedValue([gene])
    const result = await searchGenes('BRCA1')
    expect(result.results).toEqual([gene])
    expect(result.error).toBeUndefined()
  })

  it('returns empty for empty query without calling DB', async () => {
    const result = await searchGenes('')
    expect(result.results).toEqual([])
    expect(mockFetchBySearch).not.toHaveBeenCalled()
  })

  it('returns empty for whitespace-only query', async () => {
    const result = await searchGenes('   ')
    expect(result.results).toEqual([])
    expect(mockFetchBySearch).not.toHaveBeenCalled()
  })

  it('rejects query over 200 chars', async () => {
    await expect(searchGenes('A'.repeat(201))).rejects.toThrow()
  })

  it('returns error flag on DB failure', async () => {
    mockFetchBySearch.mockRejectedValue(new Error('DB down'))
    const result = await searchGenes('BRCA1')
    expect(result.results).toEqual([])
    expect(result.error).toBe('Search is temporarily unavailable.')
  })

  it('passes species filter to query', async () => {
    await searchGenes('BRCA1', 'human')
    expect(mockFetchBySearch).toHaveBeenCalledWith('BRCA1', 'human')
  })

  it('defaults species to both', async () => {
    await searchGenes('BRCA1')
    expect(mockFetchBySearch).toHaveBeenCalledWith('BRCA1', 'both')
  })
})

describe('getGeneBySymbol', () => {
  it('returns gene for valid symbol', async () => {
    const gene = {
      id: 'ENSG1',
      symbol: 'TP53',
      name: 'Tumor Protein p53',
      species: 'human',
    }
    mockFetchBySymbol.mockResolvedValue(gene)
    const result = await getGeneBySymbol('TP53')
    expect(result).toEqual(gene)
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

  it('truncates input to 20 chars', async () => {
    await findSimilarGenes('A'.repeat(30))
    expect(mockFetchSimilar).toHaveBeenCalledWith('A'.repeat(20))
  })
})
