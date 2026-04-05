/**
 * In-memory sliding-window rate limiter keyed by IP.
 *
 * This is intentionally simple — no external deps (Upstash, Redis). It runs
 * inside the Next.js server process, so the limit is per-instance. For a
 * single-instance deploy (typical for preview/staging) this is sufficient.
 * For multi-instance production, swap to Upstash or a Redis-backed limiter.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 20 })
 *   const { ok } = limiter.check(ip)
 *   if (!ok) return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
 */

interface RateLimitOptions {
  /** Sliding window duration in milliseconds. */
  windowMs: number
  /** Maximum requests per window per key. */
  max: number
}

interface RateLimitResult {
  ok: boolean
  remaining: number
  resetMs: number
}

export function createRateLimiter({ windowMs, max }: RateLimitOptions) {
  // Map<key, timestamp[]>
  const store = new Map<string, number[]>()

  // Periodic cleanup to prevent memory leaks from abandoned IPs.
  const CLEANUP_INTERVAL = 60_000
  let lastCleanup = Date.now()

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL) return
    lastCleanup = now
    const cutoff = now - windowMs
    for (const [key, timestamps] of store) {
      const filtered = timestamps.filter((t) => t > cutoff)
      if (filtered.length === 0) {
        store.delete(key)
      } else {
        store.set(key, filtered)
      }
    }
  }

  function check(key: string): RateLimitResult {
    const now = Date.now()
    cleanup(now)

    const cutoff = now - windowMs
    const timestamps = (store.get(key) ?? []).filter((t) => t > cutoff)
    timestamps.push(now)
    store.set(key, timestamps)

    const ok = timestamps.length <= max
    const remaining = Math.max(0, max - timestamps.length)
    const resetMs = timestamps.length > 0 ? timestamps[0] + windowMs - now : 0

    return { ok, remaining, resetMs }
  }

  return { check }
}
