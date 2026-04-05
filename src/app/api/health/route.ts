import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sql } from 'drizzle-orm'
import { db } from '@/drizzle/db'
import { env } from '@/lib/env'
import { createRateLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Rate limit: 20 requests per minute per IP. /api/health probes the DB, so
// an unauthenticated caller could use it as a cheap amplification vector.
const limiter = createRateLimiter({ windowMs: 60_000, max: 20 })

type CheckStatus = 'ok' | 'fail' | 'skipped'

interface Check {
  status: CheckStatus
  latencyMs?: number
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
    // Minimal round-trip to Neon — confirms connectivity without reading data.
    await db.execute(sql`SELECT 1`)
    return { status: 'ok', latencyMs: Math.round(performance.now() - start) }
  } catch (err) {
    return {
      status: 'fail',
      latencyMs: Math.round(performance.now() - start),
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
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { ok: allowed, remaining, resetMs } = limiter.check(ip)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(resetMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  const [database, modal] = await Promise.all([checkDatabase(), checkModal()])

  const degraded = database.status === 'fail' || modal.status === 'fail'

  const body: HealthResponse = {
    status: degraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
    checks: { database, modal },
  }

  return NextResponse.json(body, {
    status: degraded ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-RateLimit-Remaining': String(remaining),
    },
  })
}
