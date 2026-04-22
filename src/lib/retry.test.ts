import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isTransientError, withRetry } from './retry'

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------
describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns value on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries and succeeds on second attempt', async () => {
    vi.useRealTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, {
      baseDelayMs: 1,
      maxAttempts: 3,
      maxDelayMs: 1,
    })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting max attempts', async () => {
    vi.useRealTimers()
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    await expect(
      withRetry(fn, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 }),
    ).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('fails immediately for non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('client error'))

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        isRetryable: () => false,
      }),
    ).rejects.toThrow('client error')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respects custom maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    const promise = withRetry(fn, { maxAttempts: 1, baseDelayMs: 50 })
    await expect(promise).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// isTransientError
// ---------------------------------------------------------------------------
describe('isTransientError', () => {
  it('returns true for AbortError', () => {
    const err = new Error('timeout')
    err.name = 'AbortError'
    expect(isTransientError(err)).toBe(true)
  })

  it('returns true for TypeError (network failure)', () => {
    const err = new TypeError('Failed to fetch')
    expect(isTransientError(err)).toBe(true)
  })

  it('returns true for Modal API 500 error', () => {
    expect(isTransientError(new Error('Modal API error: HTTP 500'))).toBe(true)
  })

  it('returns false for Modal API 400 error', () => {
    expect(isTransientError(new Error('Modal API error: HTTP 400'))).toBe(false)
  })

  it('returns true for Modal API error without HTTP code', () => {
    expect(
      isTransientError(new Error('Modal API error: connection reset')),
    ).toBe(true)
  })

  it('returns true for non-Error values', () => {
    expect(isTransientError('some string')).toBe(true)
    expect(isTransientError(null)).toBe(true)
  })
})
