import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJobStatusFromApi, JobStatusError } from './job-status-client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => vi.clearAllMocks())

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
})

describe('fetchJobStatusFromApi', () => {
  it('polls the route handler, not a server action', async () => {
    mockFetch.mockResolvedValue(ok({ status: 'running', progress: 0.3 }))
    const data = await fetchJobStatusFromApi('job-1')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/jobs/job-1',
      expect.objectContaining({ cache: 'no-store' }),
    )
    expect(data.status).toBe('running')
  })

  it('passes the abort signal through', async () => {
    const controller = new AbortController()
    mockFetch.mockResolvedValue(ok({ status: 'running' }))
    await fetchJobStatusFromApi('job-1', controller.signal)
    expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it('encodes the job id', async () => {
    mockFetch.mockResolvedValue(ok({ status: 'not_found' }))
    await fetchJobStatusFromApi('a/b?c')
    expect(mockFetch.mock.calls[0][0]).toBe('/api/jobs/a%2Fb%3Fc')
  })

  it('throws a JobStatusError carrying the structured error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        error: { code: 'backend', message: 'optimizer down', retriable: true },
      }),
    })
    await expect(fetchJobStatusFromApi('job-1')).rejects.toMatchObject({
      jobError: { code: 'backend', retriable: true },
    })
  })

  it('maps a 401 to a non-retriable unauthorized error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Authentication required.' }),
    })
    const error = await fetchJobStatusFromApi('job-1').catch((e) => e)
    expect(error).toBeInstanceOf(JobStatusError)
    expect(error.jobError.code).toBe('unauthorized')
    expect(error.jobError.retriable).toBe(false)
  })

  it('rejects a body that does not match the contract', async () => {
    mockFetch.mockResolvedValue(ok({ status: 'nonsense' }))
    const error = await fetchJobStatusFromApi('job-1').catch((e) => e)
    expect(error).toBeInstanceOf(JobStatusError)
    expect(error.jobError.code).toBe('backend')
  })
})
