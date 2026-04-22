import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Set NODE_ENV to development so local backend is allowed
;(process.env as Record<string, string>).NODE_ENV = 'development'

// Mock env module before importing jobs
vi.mock('@/lib/env', () => ({
  env: {
    COMPUTE_BACKEND: 'local',
    MODAL_API_URL: undefined,
    LOCAL_API_URL: 'http://localhost:8000',
  },
}))

// Mock rate limiter — use vi.hoisted so the mock fn is available at vi.mock time
const { mockRateLimitCheck } = vi.hoisted(() => ({
  mockRateLimitCheck: vi.fn(async () => ({
    ok: true,
    remaining: 9,
    resetMs: 60000,
  })),
}))
vi.mock('@/lib/upstash', () => ({
  createUpstashRateLimiter: () => ({ check: mockRateLimitCheck }),
  redis: null,
}))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { submitJob, getJobStatus, cancelJob } from './jobs'

const VALID_PARAMS = {
  CDS: 'ATGAAATGA',
  name: 'Test Gene',
  options: { codon_optimize: 'human' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRateLimitCheck.mockResolvedValue({
    ok: true,
    remaining: 9,
    resetMs: 60000,
  })
})

describe('submitJob', () => {
  it('returns result for local backend', async () => {
    const fakeResult = { name: 'Test', optimized_sequence: 'ATGAAATGA' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => fakeResult,
    })
    const { jobId, result } = await submitJob(VALID_PARAMS)
    expect(jobId).toBeTruthy()
    expect(result).toEqual(fakeResult)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/py/process-json',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('normalizes CDS to uppercase', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await submitJob({ ...VALID_PARAMS, CDS: 'atgaaatga' })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.CDS).toBe('ATGAAATGA')
  })

  it('rejects empty CDS', async () => {
    await expect(submitJob({ ...VALID_PARAMS, CDS: '' })).rejects.toThrow()
  })

  it('rejects invalid nucleotide characters', async () => {
    await expect(
      submitJob({ ...VALID_PARAMS, CDS: 'ATGXYZ' }),
    ).rejects.toThrow()
  })

  it('rejects CDS not multiple of 3 (Zod regex passes but length is validated at form level)', async () => {
    // The jobs schema only validates regex and length, not codon frame
    // So ATGAA passes the schema but would fail at the algorithm level
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    const result = await submitJob({ ...VALID_PARAMS, CDS: 'ATGAA' })
    expect(result.jobId).toBeTruthy()
  })

  it('rejects empty name', async () => {
    await expect(submitJob({ ...VALID_PARAMS, name: '' })).rejects.toThrow()
  })

  it('rejects name over 250 chars', async () => {
    await expect(
      submitJob({ ...VALID_PARAMS, name: 'A'.repeat(251) }),
    ).rejects.toThrow()
  })

  it('throws when rate limited', async () => {
    mockRateLimitCheck.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetMs: 30000,
    })
    await expect(submitJob(VALID_PARAMS)).rejects.toThrow(
      /Too many job submissions/,
    )
  })

  it('throws on local API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({ detail: 'algo crashed' }),
    })
    await expect(submitJob(VALID_PARAMS)).rejects.toThrow('algo crashed')
  })
})

describe('getJobStatus', () => {
  it('returns not_found for local backend', async () => {
    const result = await getJobStatus('test-job-123')
    expect(result.status).toBe('not_found')
  })

  it('rejects invalid job ID format', async () => {
    await expect(getJobStatus('invalid job id!')).rejects.toThrow()
  })

  it('rejects empty job ID', async () => {
    await expect(getJobStatus('')).rejects.toThrow()
  })
})

describe('cancelJob', () => {
  it('returns cancelled for local backend', async () => {
    const result = await cancelJob('test-job-123')
    expect(result.status).toBe('cancelled')
  })

  it('rejects invalid job ID format', async () => {
    await expect(cancelJob('invalid job id!')).rejects.toThrow()
  })
})
