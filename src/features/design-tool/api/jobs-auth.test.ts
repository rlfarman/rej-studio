import { afterEach, describe, expect, it, vi } from 'vitest'

// The actions are public endpoints. These tests are the guard on that: the
// work itself lives in jobs-core.ts and takes no view on who is calling, so
// the session check here is the only thing standing in front of it.

;(process.env as Record<string, string>).NODE_ENV = 'development'

vi.mock('@/lib/env', () => ({
  env: {
    COMPUTE_BACKEND: 'local',
    MODAL_API_URL: undefined,
    LOCAL_API_URL: 'http://localhost:8000',
  },
}))

vi.mock('@/lib/upstash', () => ({
  createUpstashRateLimiter: () => ({
    check: async () => ({ ok: true, remaining: 9, resetMs: 60_000 }),
  }),
  redis: null,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { cancelJob, getJobStatus, submitJob } from './jobs'

const VALID_PARAMS = {
  CDS: 'ATGAAATGA',
  name: 'Test Gene',
  options: { codon_optimize: 'human' },
}

afterEach(() => {
  vi.unstubAllEnvs()
  mockFetch.mockClear()
})

describe('the job actions', () => {
  it('reject callers without a session when the gate is on', async () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
    vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-chars-long')

    await expect(submitJob(VALID_PARAMS)).rejects.toThrow(
      'Authentication required.',
    )
    await expect(getJobStatus('job-1')).rejects.toThrow(
      'Authentication required.',
    )
    await expect(cancelJob('job-1')).rejects.toThrow('Authentication required.')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
