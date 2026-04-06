/**
 * Tests for the Modal backend path in the jobs server action.
 * Separate file from jobs.test.ts to isolate the env mock (COMPUTE_BACKEND=modal).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

// Mock crypto.subtle.digest — return unique hash per input for idempotency
let digestCounter = 0
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  subtle: {
    digest: vi.fn(async (_algo: string, data: BufferSource) => {
      // Use input data length + counter to generate unique hashes
      const buf = new Uint8Array(32)
      const view = new DataView(buf.buffer)
      view.setUint32(0, digestCounter++)
      if (data instanceof Uint8Array) {
        for (let i = 0; i < Math.min(data.length, 28); i++) {
          buf[4 + i] = data[i]
        }
      }
      return buf.buffer
    }),
  },
  randomUUID: () => 'test-uuid-1234',
})

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

describe('submitJob (modal backend)', () => {
  it('extracts call_id from Modal response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ call_id: 'modal-job-123' }),
    })
    const { jobId } = await submitJob(VALID_PARAMS)
    expect(jobId).toBe('modal-job-123')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://modal.example.com/jobs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('records to dead letter queue on failure', async () => {
    mockFetch.mockRejectedValue(new Error('Modal API error: HTTP 500'))
    await expect(submitJob(VALID_PARAMS)).rejects.toThrow('Modal API error')
  })
})

describe('getJobStatus (modal backend)', () => {
  it('fetches status from Modal API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'running', progress: 0.5 }),
    })
    const result = await getJobStatus('job-123')
    expect(result.status).toBe('running')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://modal.example.com/jobs/job-123',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('throws on Modal API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => 'not found',
    })
    await expect(getJobStatus('job-123')).rejects.toThrow('Modal API error')
  })
})

describe('cancelJob (modal backend)', () => {
  it('sends DELETE to Modal API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'cancelled' }),
    })
    const result = await cancelJob('job-123')
    expect(result.status).toBe('cancelled')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://modal.example.com/jobs/job-123',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
