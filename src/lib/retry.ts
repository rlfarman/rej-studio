/**
 * Retry a function with exponential backoff and jitter.
 *
 * Designed for transient network failures (Modal API, external services).
 * Not suitable for user-input errors (4xx) — those should fail fast.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    /** Maximum number of attempts (including the first). Default: 3 */
    maxAttempts?: number
    /** Base delay in ms before the first retry. Default: 500 */
    baseDelayMs?: number
    /** Maximum delay cap in ms. Default: 5000 */
    maxDelayMs?: number
    /** Predicate to decide if the error is retryable. Default: all errors. */
    isRetryable?: (error: unknown) => boolean
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 5_000,
    isRetryable = () => true,
  } = opts

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxAttempts || !isRetryable(err)) throw err

      // Exponential backoff with full jitter: delay = random(0, min(cap, base * 2^attempt))
      const exponentialDelay = baseDelayMs * 2 ** (attempt - 1)
      const delay = Math.random() * Math.min(maxDelayMs, exponentialDelay)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

/**
 * Returns true for errors that are likely transient (network, timeout, 5xx).
 * Returns false for client errors (4xx) which won't succeed on retry.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    // AbortError = timeout, TypeError = network failure (fetch)
    if (error.name === 'AbortError' || error.name === 'TypeError') return true
    // Modal API error with 5xx
    if (error.message.includes('Modal API error')) {
      const match = error.message.match(/HTTP (\d{3})/)
      if (match) {
        const status = parseInt(match[1], 10)
        return status >= 500
      }
      return true // Unknown format — assume transient
    }
  }
  return true
}
