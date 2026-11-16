// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cookies } from 'next/headers'

const { mockFetchJobStatus } = vi.hoisted(() => ({
  mockFetchJobStatus: vi.fn(),
}))

vi.mock('@/features/design-tool/api/job-backend', () => ({
  fetchJobStatus: mockFetchJobStatus,
}))

import { GET } from './route'

const SESSION_SECRET = 'test-secret-that-is-at-least-32-chars-long'

function request(url = 'http://localhost/api/jobs/job-1') {
  return new Request(url) as unknown as Parameters<typeof GET>[0]
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function withCookie(value?: string) {
  vi.mocked(cookies).mockResolvedValue({
    get: () => (value ? { value } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

beforeEach(() => {
  vi.clearAllMocks()
  withCookie()
  mockFetchJobStatus.mockResolvedValue({
    ok: true,
    data: { status: 'running', progress: 0.25 },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/jobs/[id]', () => {
  it('returns the parsed status with no-store caching', async () => {
    const res = await GET(request(), params('job-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(await res.json()).toEqual({ status: 'running', progress: 0.25 })
    expect(mockFetchJobStatus).toHaveBeenCalledWith('job-1', expect.anything())
  })

  it('rejects a malformed job id before calling the backend', async () => {
    const res = await GET(request(), params('not a job id!'))
    expect(res.status).toBe(400)
    expect(mockFetchJobStatus).not.toHaveBeenCalled()
  })

  it('requires a session when the auth gate is on', async () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
    vi.stubEnv('SESSION_SECRET', SESSION_SECRET)

    const res = await GET(request(), params('job-1'))
    expect(res.status).toBe(401)
    expect(mockFetchJobStatus).not.toHaveBeenCalled()
  })

  it('serves a request carrying a valid session cookie', async () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
    vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
    const { signSession } = await import('@/lib/auth/session')
    withCookie(await signSession())

    const res = await GET(request(), params('job-1'))
    expect(res.status).toBe(200)
    expect(mockFetchJobStatus).toHaveBeenCalled()
  })

  it('maps backend error codes to HTTP statuses', async () => {
    mockFetchJobStatus.mockResolvedValue({
      ok: false,
      error: { code: 'invalid_input', message: 'nope', retriable: false },
    })
    const invalid = await GET(request(), params('job-1'))
    expect(invalid.status).toBe(422)

    mockFetchJobStatus.mockResolvedValue({
      ok: false,
      error: { code: 'backend', message: 'down', retriable: true },
    })
    const backend = await GET(request(), params('job-1'))
    expect(backend.status).toBe(502)
    expect((await backend.json()).error.code).toBe('backend')
  })
})
