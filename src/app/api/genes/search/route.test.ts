// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSearch, mockRateLimit } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockRateLimit: vi.fn(),
}))

vi.mock('@/features/gene-search/api/genes', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/gene-search/api/genes')
  >('@/features/gene-search/api/genes')
  return {
    SearchUnavailableError: actual.SearchUnavailableError,
    searchGenes: mockSearch,
    checkSearchRateLimit: mockRateLimit,
  }
})

import { GET } from './route'
import { SearchUnavailableError } from '@/features/gene-search/api/genes'
import { signSession } from '@/lib/auth/session'

const gene = {
  id: 'ENSG1',
  symbol: 'TP53',
  name: 'tumor protein p53',
  species: 'human',
}

function search(query: string, cookie?: string) {
  return GET(
    new NextRequest(`https://rejstudio.com/api/genes/search?${query}`, {
      headers: cookie ? { cookie } : undefined,
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRateLimit.mockResolvedValue({ ok: true })
  mockSearch.mockResolvedValue({
    results: [gene],
    truncated: false,
    suggestions: [],
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/genes/search', () => {
  it('returns typed results with defaults applied', async () => {
    const res = await search('q=tp53')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      results: [gene],
      truncated: false,
      suggestions: [],
    })
    expect(mockSearch).toHaveBeenCalledWith({
      q: 'tp53',
      species: 'both',
      limit: 6,
    })
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('passes species and limit through', async () => {
    await search('q=brca&species=mouse&limit=50')
    expect(mockSearch).toHaveBeenCalledWith({
      q: 'brca',
      species: 'mouse',
      limit: 50,
    })
  })

  it.each([
    'q=tp53&species=fish',
    'q=tp53&limit=0',
    'q=tp53&limit=51',
    'q=tp53&limit=abc',
    `q=${'a'.repeat(201)}`,
  ])('rejects invalid params (%s) with 400', async (query) => {
    const res = await search(query)
    expect(res.status).toBe(400)
    expect(await res.json()).toHaveProperty('error')
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('answers an empty query without spending the rate limit', async () => {
    const res = await search('q=%20%20')
    expect(res.status).toBe(200)
    expect((await res.json()).results).toEqual([])
    expect(mockRateLimit).not.toHaveBeenCalled()
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('returns 429 with Retry-After when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 12 })
    const res = await search('q=tp53')
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('12')
    expect((await res.json()).error).toMatch(/12s/)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('returns 503 JSON when the search backend fails', async () => {
    mockSearch.mockRejectedValue(new SearchUnavailableError())
    const res = await search('q=tp53')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: 'Search is temporarily unavailable.',
    })
  })

  describe('with the auth gate on', () => {
    beforeEach(() => {
      vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
      vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-chars-long')
    })

    it('rejects a request without a session', async () => {
      const res = await search('q=tp53')
      expect(res.status).toBe(401)
      expect(mockSearch).not.toHaveBeenCalled()
    })

    it('rejects a forged session cookie', async () => {
      const res = await search('q=tp53', 'rej_session=forged.value')
      expect(res.status).toBe(401)
    })

    it('serves a request with a valid session', async () => {
      const token = await signSession()
      const res = await search('q=tp53', `rej_session=${token}`)
      expect(res.status).toBe(200)
    })
  })
})
