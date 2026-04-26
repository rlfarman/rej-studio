import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { existsSync } from 'fs'
import { join } from 'path'
import { env } from '@/lib/env'
import { createUpstashRateLimiter } from '@/lib/upstash'
import { withCors } from '@/lib/api-cors'

// Rate limit: 20 requests per minute per IP.
const limiter = createUpstashRateLimiter({
  prefix: 'health',
  maxRequests: 20,
  windowMs: 60_000,
})

const HEALTH_AUTH_TOKEN = process.env.HEALTH_AUTH_TOKEN

// --- Types ------------------------------------------------------------------
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
    content: Check
    modal: Check
  }
}

/**
 * Verify the static content artifacts shipped with the deploy. There's no
 * runtime DB to ping — gene/isoform reads come from public/data, written at
 * build by `pnpm content:rebuild`.
 */
function checkContent(): Check {
  const root = process.cwd()
  const required = [
    'public/data/manifest.json',
    'public/data/isoform-index.json',
  ]
  for (const path of required) {
    if (!existsSync(join(root, path))) {
      return { status: 'fail', error: `missing ${path}` }
    }
  }
  return { status: 'ok' }
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
  const { ok: allowed, remaining, resetMs } = await limiter.check(ip)

  if (!allowed) {
    const retryAfter = Math.ceil(resetMs / 1000)
    return withCors(
      NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(retryAfter),
          },
        },
      ),
      origin,
    )
  }

  const [content, modal] = await Promise.all([
    Promise.resolve(checkContent()),
    checkModal(),
  ])

  const degraded = content.status === 'fail' || modal.status === 'fail'

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
    checks: { content, modal },
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
