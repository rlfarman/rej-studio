// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { headers } from 'next/headers'

const { mockExecute, mockProbeGeneData } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockProbeGeneData: vi.fn(),
}))

vi.mock('@/drizzle/db', () => ({
  getDb: vi.fn(async () => ({ execute: mockExecute })),
}))
vi.mock('@/features/gene-search/api/static-gene-data', () => ({
  probeGeneData: mockProbeGeneData,
}))
vi.mock('@/lib/upstash', () => ({
  createUpstashRateLimiter: () => ({
    check: vi.fn(async () => ({ ok: true, remaining: 19, resetMs: 60_000 })),
  }),
  redis: null,
}))

import { GET } from './route'

function withAuthorization(value?: string) {
  const h = new Headers({ 'x-forwarded-for': '127.0.0.1' })
  if (value) h.set('authorization', value)
  vi.mocked(headers).mockResolvedValue(
    h as unknown as Awaited<ReturnType<typeof headers>>,
  )
}

describe('GET /api/health', () => {
  beforeEach(() => {
    mockExecute.mockReset()
    mockExecute.mockResolvedValue([])
    // Genes from Postgres unless a test says otherwise.
    mockProbeGeneData.mockReset()
    mockProbeGeneData.mockResolvedValue(null)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('answers anonymous production probes without touching the DB', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    withAuthorization()
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('needs the bearer token for deep checks when one is configured', async () => {
    vi.stubEnv('HEALTH_AUTH_TOKEN', 'probe-token')

    withAuthorization('Bearer wrong-token')
    await GET()
    expect(mockExecute).not.toHaveBeenCalled()

    withAuthorization('Bearer probe-token')
    const res = await GET()
    expect(mockExecute).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.checks.database.status).toBe('ok')
  })

  it('runs deep checks outside production when no token is configured', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    withAuthorization()
    const res = await GET()
    expect(mockExecute).toHaveBeenCalledOnce()
    expect((await res.json()).checks).toBeDefined()
  })

  it('checks the static corpus instead of the database when genes come from it', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    mockProbeGeneData.mockResolvedValue('ok')
    withAuthorization()
    const body = await (await GET()).json()
    expect(mockExecute).not.toHaveBeenCalled()
    expect(body.checks.database.status).toBe('skipped')
    expect(body.checks.geneData.status).toBe('ok')
  })

  it('reports degraded when the static corpus is unreachable', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    mockProbeGeneData.mockRejectedValue(new Error('HTTP 503'))
    withAuthorization()
    const res = await GET()
    expect(res.status).toBe(503)
    expect((await res.json()).checks.geneData).toMatchObject({
      status: 'fail',
      error: 'HTTP 503',
    })
  })
})
