/**
 * Tests for the Modal backend path in the jobs server action.
 * Separate file from jobs.test.ts to isolate the env mock (COMPUTE_BACKEND=modal).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Set NODE_ENV to development to bypass production check
;(process.env as Record<string, string>).NODE_ENV = 'development'

vi.mock('@/lib/env', () => ({
  env: {
    COMPUTE_BACKEND: 'modal',
    MODAL_API_URL: 'https://modal.example.com',
    LOCAL_API_URL: undefined,
  },
}))

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

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock crypto.subtle.digest — hash only the payload, so identical inputs
// collide (that's what the idempotency key is for) and different ones don't.
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  subtle: {
    digest: vi.fn(async (_algo: string, data: BufferSource) => {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(0)
      const buf = new Uint8Array(32)
      // Cheap deterministic hash (FNV-ish) over the payload bytes.
      let h = 2166136261
      for (const byte of bytes) {
        h = (h ^ byte) * 16777619
        h >>>= 0
      }
      new DataView(buf.buffer).setUint32(0, h)
      return buf.buffer
    }),
  },
  randomUUID: () => 'test-uuid-1234',
})

import { submitJob, cancelJob } from './jobs'
import { fetchJobStatus, resetCircuitForTests } from './job-backend'

const VALID_PARAMS = {
  CDS: 'ATGAAATGA',
  name: 'Test Gene',
  options: {
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
  },
}

/** A distinct payload, so it gets its own idempotency key. */
function paramsWithName(name: string) {
  return { ...VALID_PARAMS, name, options: { ...VALID_PARAMS.options } }
}

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
})

const notOk = (status: number, body: unknown = {}) => ({
  ok: false,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
})

beforeEach(() => {
  vi.clearAllMocks()
  resetCircuitForTests()
  mockRateLimitCheck.mockResolvedValue({
    ok: true,
    remaining: 9,
    resetMs: 60000,
  })
})

describe('submitJob (modal backend)', () => {
  it('extracts call_id from Modal response', async () => {
    mockFetch.mockResolvedValue(ok({ call_id: 'modal-job-123' }))
    const outcome = await submitJob(VALID_PARAMS)
    expect(outcome).toEqual({ ok: true, data: { jobId: 'modal-job-123' } })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://modal.example.com/jobs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('sends the bearer token when MODAL_API_TOKEN is set', async () => {
    vi.stubEnv('MODAL_API_TOKEN', 'tok-abc')
    mockFetch.mockResolvedValue(ok({ call_id: 'modal-auth-1' }))
    await submitJob(paramsWithName('Auth Gene'))
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer tok-abc')
    vi.unstubAllEnvs()
  })

  it('returns a typed error instead of throwing when Modal is down', async () => {
    mockFetch.mockResolvedValue(notOk(503, { detail: 'no capacity' }))
    const outcome = await submitJob(paramsWithName('Down Gene'))
    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('backend')
    expect(outcome.error.retriable).toBe(true)
  })

  it('maps 422 to a non-retriable invalid_input error', async () => {
    mockFetch.mockResolvedValue(notOk(422, { detail: 'one split point only' }))
    const outcome = await submitJob(paramsWithName('Invalid Gene'))
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('invalid_input')
    expect(outcome.error.retriable).toBe(false)
    expect(outcome.error.message).toBe('one split point only')
  })

  it('maps 401 to unauthorized', async () => {
    mockFetch.mockResolvedValue(notOk(401, { detail: 'bad token' }))
    const outcome = await submitJob(paramsWithName('Unauthorized Gene'))
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('unauthorized')
    expect(outcome.error.retriable).toBe(false)
  })

  it('does not re-POST after a timeout (no duplicate Modal jobs)', async () => {
    const abort = Object.assign(new Error('timed out'), { name: 'AbortError' })
    mockFetch.mockRejectedValue(abort)
    const outcome = await submitJob(paramsWithName('Timeout Gene'))
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('timeout')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries once when the connection never reached the server', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(ok({ call_id: 'modal-retry-1' }))
    const outcome = await submitJob(paramsWithName('Retry Gene'))
    expect(outcome).toEqual({ ok: true, data: { jobId: 'modal-retry-1' } })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('rejects a malformed submit response', async () => {
    mockFetch.mockResolvedValue(ok({ oops: true }))
    const outcome = await submitJob(paramsWithName('Malformed Gene'))
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('backend')
    expect(outcome.error.retriable).toBe(false)
  })

  it('returns a rate-limit error carrying the wait time', async () => {
    mockRateLimitCheck.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetMs: 12_000,
    })
    const outcome = await submitJob(paramsWithName('Busy Gene'))
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('rate_limited')
    expect(outcome.error.message).toContain('12')
  })

  it('does not trip the circuit breaker on repeated 4xx submissions', async () => {
    mockFetch.mockResolvedValue(notOk(422, { detail: 'bad sequence' }))
    for (let i = 0; i < 6; i++) {
      const outcome = await submitJob(paramsWithName(`Bad Gene ${i}`))
      if (outcome.ok) throw new Error('expected failure')
      expect(outcome.error.code).toBe('invalid_input')
    }
    // Breaker still closed: a good submission goes through.
    mockFetch.mockResolvedValue(ok({ call_id: 'after-4xx' }))
    const outcome = await submitJob(paramsWithName('Good Gene'))
    expect(outcome).toEqual({ ok: true, data: { jobId: 'after-4xx' } })
  })

  it('trips the circuit breaker after repeated 5xx submissions', async () => {
    mockFetch.mockResolvedValue(notOk(500, { detail: 'boom' }))
    for (let i = 0; i < 5; i++) {
      await submitJob(paramsWithName(`Broken Gene ${i}`))
    }
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(ok({ call_id: 'never-sent' }))
    const outcome = await submitJob(paramsWithName('Blocked Gene'))
    if (outcome.ok) throw new Error('expected the breaker to be open')
    expect(outcome.error.code).toBe('backend')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('idempotency', () => {
  it('reuses the in-flight job for an identical submission', async () => {
    mockFetch.mockResolvedValue(ok({ call_id: 'inflight-1' }))
    const first = await submitJob(paramsWithName('Dedupe Gene'))
    expect(first).toEqual({ ok: true, data: { jobId: 'inflight-1' } })

    // Second submit: the status check says it's still running, so the
    // existing job id comes back without a new POST.
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(ok({ status: 'running', progress: 0.2 }))
    const second = await submitJob(paramsWithName('Dedupe Gene'))
    expect(second).toEqual({ ok: true, data: { jobId: 'inflight-1' } })
    expect(mockFetch).toHaveBeenCalledTimes(1) // the status check only
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://modal.example.com/jobs/inflight-1',
    )
  })

  it('submits a fresh job when the cached one was cancelled', async () => {
    mockFetch.mockResolvedValue(ok({ call_id: 'cancelled-1' }))
    await submitJob(paramsWithName('Rerun Gene'))

    // Cancel clears the idempotency entry…
    mockFetch.mockResolvedValue(ok({ status: 'cancelled' }))
    await cancelJob('cancelled-1')

    // …so the same inputs start a new job rather than resolving to the
    // dead id for the rest of the 10-minute TTL.
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(ok({ call_id: 'rerun-2' }))
    const outcome = await submitJob(paramsWithName('Rerun Gene'))
    expect(outcome).toEqual({ ok: true, data: { jobId: 'rerun-2' } })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://modal.example.com/jobs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('submits a fresh job when the cached one already failed', async () => {
    mockFetch.mockResolvedValue(ok({ call_id: 'failed-1' }))
    await submitJob(paramsWithName('Failed Gene'))

    mockFetch.mockClear()
    mockFetch
      // status check for the cached id → failed, so don't reuse it
      .mockResolvedValueOnce(
        ok({
          status: 'failed',
          error: { code: 'backend', message: 'boom', retriable: false },
        }),
      )
      .mockResolvedValueOnce(ok({ call_id: 'failed-retry-2' }))
    const outcome = await submitJob(paramsWithName('Failed Gene'))
    expect(outcome).toEqual({ ok: true, data: { jobId: 'failed-retry-2' } })
  })
})

describe('fetchJobStatus (modal backend)', () => {
  it('parses a running status', async () => {
    mockFetch.mockResolvedValue(ok({ status: 'running', progress: 0.5 }))
    const result = await fetchJobStatus('job-123')
    if (!result.ok) throw new Error('expected success')
    expect(result.data.status).toBe('running')
    expect(result.data.progress).toBe(0.5)
  })

  it('parses a realistic completed result', async () => {
    const payload = {
      status: 'completed',
      result: {
        name: 'TP53',
        original_sequence: 'ATGAAATGA',
        optimized_sequence: 'ATGAAGTGA',
        seq5: 'ATGAA',
        seq3: 'GTGA',
        split_point: 5,
        used_wggw_as_split: true,
        objectives_before: 'TOTAL OBJECTIVES SCORE: -12',
        objectives_after: 'TOTAL OBJECTIVES SCORE: -2',
        objectives_report_before: {
          entries: [
            {
              objective: 'EnforceGCContent[0-9(+)](mini=0.35, maxi=0.60)',
              passes: false,
              score: -1.5,
              message: 'GC content = 70.2%',
              locations: [{ start: 0, end: 9, strand: 1 }],
            },
          ],
          total_score: -12,
        },
        objectives_report_after: { entries: [], total_score: -2 },
        wggw_info: {
          main: {
            position: 5,
            motif: 'AGGT',
            distance_from_split: 0,
            original_codons: ['AGG', 'TGG'],
            new_codons: ['AGG', 'TGG'],
          },
        },
        processing_time_seconds: 3.4,
        seed: 42,
      },
    }
    mockFetch.mockResolvedValue(ok(payload))
    const result = await fetchJobStatus('job-complete')
    if (!result.ok) throw new Error('expected success')
    expect(result.data.status).toBe('completed')
    expect(result.data.result?.wggw_info?.main.motif).toBe('AGGT')
    expect(result.data.result?.seed).toBe(42)
    expect(
      result.data.result?.objectives_report_before.entries[0].locations,
    ).toHaveLength(1)
  })

  it('fills defaults for an older payload without objective reports', async () => {
    mockFetch.mockResolvedValue(
      ok({
        status: 'completed',
        result: {
          name: 'Legacy',
          original_sequence: 'ATGTGA',
          optimized_sequence: 'ATGTGA',
          seq5: 'ATG',
          seq3: 'TGA',
          split_point: 3,
          used_wggw_as_split: false,
          objectives_before: '',
          objectives_after: '',
          processing_time_seconds: 1,
        },
      }),
    )
    const result = await fetchJobStatus('job-legacy')
    if (!result.ok) throw new Error('expected success')
    expect(result.data.result?.objectives_report_after).toEqual({
      entries: [],
      total_score: null,
    })
    expect(result.data.result?.wggw_info).toBeNull()
  })

  it('returns a typed error for a Modal failure', async () => {
    mockFetch.mockResolvedValue(notOk(502, { detail: 'bad gateway' }))
    const result = await fetchJobStatus('job-123')
    if (result.ok) throw new Error('expected failure')
    expect(result.error.code).toBe('backend')
  })

  it('collapses an unknown error code to unknown', async () => {
    mockFetch.mockResolvedValue(
      ok({
        status: 'failed',
        error: { code: 'wat', message: 'new code', retriable: false },
      }),
    )
    const result = await fetchJobStatus('job-123')
    if (!result.ok) throw new Error('expected success')
    expect(result.data.error?.code).toBe('unknown')
  })
})

describe('cancelJob (modal backend)', () => {
  it('sends DELETE to Modal API', async () => {
    mockFetch.mockResolvedValue(ok({ status: 'cancelled' }))
    const outcome = await cancelJob('job-123')
    if (!outcome.ok) throw new Error('expected success')
    expect(outcome.data.status).toBe('cancelled')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://modal.example.com/jobs/job-123',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
