// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const getGeneBySymbol = vi.hoisted(() => vi.fn(async () => null))
vi.mock('@/features/gene-search/api/genes', () => ({ getGeneBySymbol }))
vi.mock('@/features/gene-search/api/isoform-queries', () => ({
  fetchIsoformSummaryByGene: vi.fn(),
}))
const limiterCheck = vi.hoisted(() =>
  vi.fn(async (_key: string) => ({ ok: true, remaining: 59, resetMs: 0 })),
)
vi.mock('@/lib/upstash', () => ({
  createUpstashRateLimiter: () => ({ check: limiterCheck }),
  redis: null,
}))

import { GET } from './route'

function get(symbol: string) {
  return GET(
    new Request(
      `https://rejstudio.com/api/og/gene/${encodeURIComponent(symbol)}`,
    ),
    { params: Promise.resolve({ symbol }) },
  )
}

afterEach(() => {
  getGeneBySymbol.mockClear()
  limiterCheck.mockClear()
})

describe('GET /api/og/gene/[symbol]', () => {
  it.each(['x'.repeat(500), '../../etc/passwd', 'TP53 OR 1=1', '<b>'])(
    'rejects %j before touching the database or the limiter',
    async (symbol) => {
      const res = await get(symbol)
      expect(res.status).toBe(404)
      expect(getGeneBySymbol).not.toHaveBeenCalled()
      expect(limiterCheck).not.toHaveBeenCalled()
    },
  )

  it('rate-limits before the lookup', async () => {
    limiterCheck.mockResolvedValueOnce({ ok: false, remaining: 0, resetMs: 1 })
    const res = await get('TP53')
    expect(res.status).toBe(429)
    expect(getGeneBySymbol).not.toHaveBeenCalled()
  })

  it('looks up a plausible symbol', async () => {
    const res = await get('TP53')
    expect(getGeneBySymbol).toHaveBeenCalledWith('TP53', undefined)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
  })
})
