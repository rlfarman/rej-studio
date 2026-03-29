interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 60 // 60 requests per minute
const CLEANUP_INTERVAL_MS = 5 * 60_000 // clean up every 5 minutes

function cleanup() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS).unref()

export function rateLimit(key: string): { ok: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true, remaining: MAX_REQUESTS - 1 }
  }

  entry.count++

  if (entry.count > MAX_REQUESTS) {
    return { ok: false, remaining: 0 }
  }

  return { ok: true, remaining: MAX_REQUESTS - entry.count }
}
