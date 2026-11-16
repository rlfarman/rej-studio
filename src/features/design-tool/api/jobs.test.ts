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

import { submitJob, cancelJob } from './jobs'
import { fetchJobStatus } from './job-backend'

const OPTIONS = {
  codon_optimize: 'human' as const,
  codon_optimize_weight: 1,
  remove_cryptic_ss: true,
  remove_cryptic_ss_weight: 1,
  minimize_CpGs: true,
  minimize_CpGs_weight: 1,
  reduce_kmer_complexity: true,
  reduce_kmer_complexity_weight: 1,
  enforce_gc: true,
  stim_5: true,
  stim_3: true,
  split_point: 3,
  selected_wggw_site: null,
  ensure_wggw: true,
  wggw_threshold: 300,
}

const VALID_PARAMS = {
  CDS: 'ATGAAATGA',
  name: 'Test Gene',
  options: OPTIONS,
}

const LOCAL_RESULT = {
  name: 'Test Gene',
  original_sequence: 'ATGAAATGA',
  optimized_sequence: 'ATGAAGTGA',
  seq5: 'ATGAA',
  seq3: 'GTGA',
  split_point: 3,
  used_wggw_as_split: false,
  objectives_before: '',
  objectives_after: '',
  processing_time_seconds: 0.8,
}

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
})

beforeEach(() => {
  vi.clearAllMocks()
  mockRateLimitCheck.mockResolvedValue({
    ok: true,
    remaining: 9,
    resetMs: 60000,
  })
})

describe('submitJob', () => {
  it('returns a parsed result for the local backend', async () => {
    mockFetch.mockResolvedValue(ok(LOCAL_RESULT))
    const outcome = await submitJob(VALID_PARAMS)
    if (!outcome.ok) throw new Error('expected success')
    expect(outcome.data.jobId).toBeTruthy()
    expect(outcome.data.result?.optimized_sequence).toBe('ATGAAGTGA')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/py/process-json',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('normalizes CDS to uppercase', async () => {
    mockFetch.mockResolvedValue(ok(LOCAL_RESULT))
    await submitJob({ ...VALID_PARAMS, CDS: 'atgaaatga' })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.CDS).toBe('ATGAAATGA')
  })

  it('rejects empty CDS', async () => {
    const outcome = await submitJob({ ...VALID_PARAMS, CDS: '' })
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects invalid nucleotide characters', async () => {
    const outcome = await submitJob({ ...VALID_PARAMS, CDS: 'ATGXYZ' })
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
  })

  // The server used to accept anything matching /[ACGTU]+/, so a frame-shifted
  // or stop-less sequence reached the optimizer even though the form would
  // have rejected it. Both now share one schema.
  it('rejects a CDS that is not a whole number of codons', async () => {
    const outcome = await submitJob({ ...VALID_PARAMS, CDS: 'ATGAA' })
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects a CDS with no start codon', async () => {
    const outcome = await submitJob({ ...VALID_PARAMS, CDS: 'AAAAAATGA' })
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
  })

  it('rejects a CDS with a premature stop codon', async () => {
    const outcome = await submitJob({ ...VALID_PARAMS, CDS: 'ATGTGAAAATGA' })
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
  })

  it('rejects unknown option shapes', async () => {
    const outcome = await submitJob({
      ...VALID_PARAMS,
      // @ts-expect-error — deliberately wrong option payload
      options: { codon_optimize: 'octopus' },
    })
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
  })

  it('rejects empty name', async () => {
    const outcome = await submitJob({ ...VALID_PARAMS, name: '' })
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
  })

  it('rejects name over 250 chars', async () => {
    const outcome = await submitJob({ ...VALID_PARAMS, name: 'A'.repeat(251) })
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
  })

  it('returns a rate-limit error rather than throwing', async () => {
    mockRateLimitCheck.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetMs: 30000,
    })
    const outcome = await submitJob(VALID_PARAMS)
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('rate_limited')
    expect(outcome.error.message).toMatch(/30/)
  })

  it('surfaces a local API failure as a typed error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ detail: 'algo crashed' }),
      text: async () => JSON.stringify({ detail: 'algo crashed' }),
    })
    const outcome = await submitJob(VALID_PARAMS)
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('backend')
    expect(outcome.error.retriable).toBe(true)
  })

  // The optimizer catches its own exceptions and still answers 200, with
  // empty sequences and the error text in objectives_after. That is not a
  // usable run, so it must not be recorded as a completed one.
  it('rejects a 200 that carries no sequences', async () => {
    mockFetch.mockResolvedValue(
      ok({
        ...LOCAL_RESULT,
        original_sequence: '',
        optimized_sequence: '',
        seq5: '',
        seq3: '',
        objectives_after: "Error: 'str' object has no attribute 'iter_bar'",
      }),
    )
    const outcome = await submitJob(VALID_PARAMS)
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('backend')
    expect(outcome.error.retriable).toBe(false)
  })

  it('reports an unreachable backend in plain language', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'))
    const outcome = await submitJob(VALID_PARAMS)
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('network')
    expect(outcome.error.message).not.toContain('fetch failed')
    expect(outcome.error.message).toMatch(/try again/i)
  })
})

describe('fetchJobStatus', () => {
  it('returns not_found for the local backend', async () => {
    const result = await fetchJobStatus('test-job-123')
    if (!result.ok) throw new Error('expected success')
    expect(result.data.status).toBe('not_found')
  })
})

describe('cancelJob', () => {
  it('returns cancelled for local backend', async () => {
    const outcome = await cancelJob('test-job-123')
    if (!outcome.ok) throw new Error('expected success')
    expect(outcome.data.status).toBe('cancelled')
  })

  it('rejects invalid job ID format', async () => {
    const outcome = await cancelJob('invalid job id!')
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
  })
})

describe('job actions auth gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses callers without a session when the gate is on', async () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
    vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-chars-long')

    const submitted = await submitJob(VALID_PARAMS)
    if (submitted.ok) throw new Error('expected failure')
    expect(submitted.error.code).toBe('unauthorized')

    const cancelled = await cancelJob('job-1')
    if (cancelled.ok) throw new Error('expected failure')
    expect(cancelled.error.code).toBe('unauthorized')

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
