import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sql } from 'drizzle-orm'
import { db } from '@/drizzle/db'
import { env } from '@/lib/env'
import { createUpstashRateLimiter, redis } from '@/lib/upstash'
import { withCors } from '@/lib/api-cors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Rate limit: 20 requests per minute per IP.
const limiter = createUpstashRateLimiter({
  prefix: 'health',
  maxRequests: 20,
  windowMs: 60_000,
})

const HEALTH_AUTH_TOKEN = process.env.HEALTH_AUTH_TOKEN

// --- Rolling latency tracker ------------------------------------------------
// Keeps the last N DB latency samples so the health endpoint can report
// percentiles (p50, p95, p99) over time, not just a point-in-time ping.
// When Redis is available, samples persist across redeploys and are shared
// across instances. Falls back to in-memory otherwise.
const MAX_SAMPLES = 100
const LATENCY_KEY = 'health:db_latency'
const dbLatencySamplesLocal: number[] = []

async function recordLatency(ms: number) {
  if (redis) {
    try {
      await redis.lpush(LATENCY_KEY, ms)
      await redis.ltrim(LATENCY_KEY, 0, MAX_SAMPLES - 1)
      return
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  dbLatencySamplesLocal.push(ms)
  if (dbLatencySamplesLocal.length > MAX_SAMPLES) dbLatencySamplesLocal.shift()
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function getLatencyStats() {
  let samples: number[]
  if (redis) {
    try {
      const raw = await redis.lrange(LATENCY_KEY, 0, MAX_SAMPLES - 1)
      samples = raw.map(Number)
    } catch {
      // Redis unavailable — fall through to local
      samples = dbLatencySamplesLocal
    }
  } else {
    samples = dbLatencySamplesLocal
  }
  if (samples.length === 0) return null
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    samples: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  }
}

// --- Types ------------------------------------------------------------------
type CheckStatus = 'ok' | 'fail' | 'skipped'

interface Check {
  status: CheckStatus
  latencyMs?: number
  latencyStats?: Awaited<ReturnType<typeof getLatencyStats>>
  error?: string
}

interface HealthResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  version: string
  checks: {
    database: Check
    modal: Check
  }
}

async function checkDatabase(): Promise<Check> {
  const start = performance.now()
  try {
    await db.execute(sql`SELECT 1`)
    const ms = Math.round(performance.now() - start)
    await recordLatency(ms)
    return {
      status: 'ok',
      latencyMs: ms,
      latencyStats: await getLatencyStats(),
    }
  } catch (err) {
    const ms = Math.round(performance.now() - start)
    return {
      status: 'fail',
      latencyMs: ms,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

async function checkModal(): Promise<Check> {
  if (env.COMPUTE_BACKEND !== 'modal' || !env.MODAL_API_URL) {
    return { status: 'skipped' }
  }
  const start = performance.now()
  try {
    // Probe the Modal ASGI app's /docs (FastAPI's default). We don't need a
    // custom health endpoint on the Modal side — any 2xx from the web app
    // proves the container spun up and is serving.
    const response = await fetch(`${env.MODAL_API_URL}/docs`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      return {
        status: 'fail',
        latencyMs: Math.round(performance.now() - start),
        error: `HTTP ${response.status}`,
      }
    }
    return { status: 'ok', latencyMs: Math.round(performance.now() - start) }
  } catch (err) {
    return {
      status: 'fail',
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

export async function GET() {
  const hdrs = await headers()
  const origin = hdrs.get('origin')
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { ok: allowed, remaining } = await limiter.check(ip)

  if (!allowed) {
    return withCors(
      NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0',
          },
        },
      ),
      origin,
    )
  }

  const [database, modal] = await Promise.all([checkDatabase(), checkModal()])

  const degraded = database.status === 'fail' || modal.status === 'fail'

  // When HEALTH_AUTH_TOKEN is configured, require it to see full check details.
  // Unauthenticated callers still get a status code (for load-balancer probes)
  // but no internal info.
  if (HEALTH_AUTH_TOKEN) {
    const authHeader = hdrs.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token !== HEALTH_AUTH_TOKEN) {
      return withCors(
        NextResponse.json(
          { status: degraded ? 'degraded' : 'ok' },
          {
            status: degraded ? 503 : 200,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
              'X-RateLimit-Remaining': String(remaining),
            },
          },
        ),
        origin,
      )
    }
  }

  const body: HealthResponse = {
    status: degraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
    checks: { database, modal },
  }

  return withCors(
    NextResponse.json(body, {
      status: degraded ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-RateLimit-Remaining': String(remaining),
      },
    }),
    origin,
  )
}
