// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchAllGeneSymbols, mockConnection } = vi.hoisted(() => ({
  mockFetchAllGeneSymbols: vi.fn(),
  mockConnection: vi.fn(async () => {}),
}))

vi.mock('@/features/gene-search/api/gene-queries', () => ({
  fetchAllGeneSymbols: mockFetchAllGeneSymbols,
}))
vi.mock('next/server', () => ({ connection: mockConnection }))

import sitemap from './sitemap'
import robots from './robots'

const BASE = 'https://rejstudio.com'

describe('sitemap and robots', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', BASE)
    mockFetchAllGeneSymbols.mockResolvedValue([
      { symbol: 'TP53', species: 'human' },
    ])
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('while password-gated', () => {
    beforeEach(() => {
      vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
    })

    it('lists only static pages and never queries the database', async () => {
      const urls = (await sitemap()).map((e) => e.url)
      expect(urls).toEqual([BASE, `${BASE}/genes`])
      expect(mockFetchAllGeneSymbols).not.toHaveBeenCalled()
      // No connection() call means the route can prerender as static.
      expect(mockConnection).not.toHaveBeenCalled()
    })

    it('asks crawlers to stay out', () => {
      expect(robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] })
    })
  })

  describe('when public', () => {
    beforeEach(() => {
      vi.stubEnv('BASIC_AUTH_PASSWORD', '')
    })

    it('adds gene URLs from the cached query at request time', async () => {
      const urls = (await sitemap()).map((e) => e.url)
      expect(urls).toContain(`${BASE}/genes/TP53?species=human`)
      expect(mockConnection).toHaveBeenCalledOnce()
      expect(mockFetchAllGeneSymbols).toHaveBeenCalledOnce()
    })

    it('allows crawling and points at the sitemap', () => {
      const result = robots()
      expect(result.sitemap).toBe(`${BASE}/sitemap.xml`)
      expect(result.rules).toEqual([
        expect.objectContaining({ disallow: ['/api/', '/design-tool'] }),
      ])
    })
  })
})
