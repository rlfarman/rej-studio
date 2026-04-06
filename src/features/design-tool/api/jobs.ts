'use server'

// --- Compute backend actions ---
// In production, COMPUTE_BACKEND=modal is required on every host (Vercel and
// Cloudflare). The local FastAPI backend is a dev-only convenience: in dev
// you can set COMPUTE_BACKEND=local (or leave it unset) to hit uvicorn at
// http://127.0.0.1:8000, and COMPUTE_BACKEND=modal still works too.

import { z } from 'zod'
import { headers } from 'next/headers'
import { createUpstashRateLimiter, redis } from '@/lib/upstash'
import { env } from '@/lib/env'
import { withRetry, isTransientError } from '@/lib/retry'
import { createLogger } from '@/lib/logger'

const log = createLogger('jobs')

// --- Input validation ---

const jobParamsSchema = z.object({
  CDS: z
    .string()
    .min(1)
    .max(50_000)
    .regex(/^[ACGTUacgtu]+$/, 'Invalid characters in coding sequence.'),
  name: z.string().min(1).max(250),
  options: z.record(z.string(), z.unknown()),
})

const jobIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid job id.')

interface JobParams {
  CDS: string
  name: string
  options: Record<string, unknown>
}

interface JobErrorPayload {
  code: string
  message: string
  retriable: boolean
}

interface JobStatusResult {
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'not_found'
  result?: Record<string, unknown>
  error?: JobErrorPayload
  progress?: number
  stage?: string
}

// --- Rate limiter ---
// 10 job submissions per minute per IP. Prevents a single caller from burning
// through Modal compute budget.
const submitLimiter = createUpstashRateLimiter({
  prefix: 'jobs',
  maxRequests: 10,
  windowMs: 60_000,
})

// --- Idempotency ---
// Hash (CDS, options) to a stable key. If the same job is submitted twice
// before the first resolves, return the existing call_id instead of spawning
// a second worker. When Redis is available, this survives redeploys and works
// across instances. Falls back to in-memory Map otherwise.
const INFLIGHT_TTL_S = 600 // 10 minutes
const inflightLocal = new Map<string, { jobId: string; expiresAt: number }>()

async function idempotencyKey(params: {
  CDS: string
  options: Record<string, unknown>
}): Promise<string> {
  const payload = JSON.stringify({ CDS: params.CDS, options: params.options })
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(payload),
  )
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getInflight(key: string): Promise<string | null> {
  if (redis) {
    try {
      return await redis.get<string>(`inflight:${key}`)
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  const entry = inflightLocal.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    inflightLocal.delete(key)
    return null
  }
  return entry.jobId
}

async function setInflight(key: string, jobId: string) {
  if (redis) {
    try {
      await redis.set(`inflight:${key}`, jobId, { ex: INFLIGHT_TTL_S })
      return
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  inflightLocal.set(key, {
    jobId,
    expiresAt: Date.now() + INFLIGHT_TTL_S * 1000,
  })
}

// --- Circuit breaker ---
// Trips after THRESHOLD consecutive failures to Modal. When open, fail fast
// with a clear message instead of hanging 30s. When Redis is available, state
// is shared across instances. Falls back to in-memory otherwise.
const CB_THRESHOLD = 5
const CB_RESET_S = 30
const CB_KEY = 'circuit:modal'

const circuitLocal = { failures: 0, open: false, openedAt: 0 }

async function circuitCheck(): Promise<{ tripped: boolean }> {
  if (redis) {
    try {
      const state = await redis.hgetall(CB_KEY)
      if (!state || !state.open) return { tripped: false }
      const openedAt = Number(state.openedAt ?? 0)
      if (Date.now() - openedAt > CB_RESET_S * 1000) {
        await redis.del(CB_KEY)
        return { tripped: false }
      }
      return { tripped: true }
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  if (!circuitLocal.open) return { tripped: false }
  if (Date.now() - circuitLocal.openedAt > CB_RESET_S * 1000) {
    circuitLocal.open = false
    circuitLocal.failures = 0
    return { tripped: false }
  }
  return { tripped: true }
}

async function circuitRecordSuccess() {
  if (redis) {
    try {
      await redis.del(CB_KEY)
      return
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  circuitLocal.failures = 0
  circuitLocal.open = false
}

async function circuitRecordFailure() {
  if (redis) {
    try {
      const failures = await redis.hincrby(CB_KEY, 'failures', 1)
      if (failures >= CB_THRESHOLD) {
        await redis.hset(CB_KEY, { open: '1', openedAt: String(Date.now()) })
        await redis.expire(CB_KEY, CB_RESET_S)
      }
      return
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  circuitLocal.failures++
  if (circuitLocal.failures >= CB_THRESHOLD) {
    circuitLocal.open = true
    circuitLocal.openedAt = Date.now()
  }
}

// --- Dead letter queue ---
// Tracks failed Modal submissions so they can be inspected via the health
// endpoint. When Redis is available, persists across redeploys. Capped at
// MAX_DLQ entries to bound storage.

interface DeadLetterEntry {
  timestamp: string
  name: string
  cdsLength: number
  error: string
  ip: string
}

const MAX_DLQ = 50
const dlqLocal: DeadLetterEntry[] = []
const DLQ_KEY = 'dlq:jobs'

async function recordDeadLetter(entry: DeadLetterEntry) {
  log.error('job submission failed — added to DLQ', undefined, {
    name: entry.name,
    cdsLength: entry.cdsLength,
  })
  if (redis) {
    try {
      await redis.lpush(DLQ_KEY, JSON.stringify(entry))
      await redis.ltrim(DLQ_KEY, 0, MAX_DLQ - 1)
      return
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  dlqLocal.push(entry)
  if (dlqLocal.length > MAX_DLQ) dlqLocal.shift()
}

/** Expose DLQ for the health/admin endpoint. */
async function getDeadLetterQueue(): Promise<readonly DeadLetterEntry[]> {
  if (redis) {
    try {
      const items = await redis.lrange(DLQ_KEY, 0, MAX_DLQ - 1)
      return items.map((item) =>
        typeof item === 'string' ? JSON.parse(item) : (item as DeadLetterEntry),
      )
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  return dlqLocal
}

// --- Backend routing ---

type ComputeBackend = 'modal' | 'local'

function getComputeBackend(): ComputeBackend {
  const value = env.COMPUTE_BACKEND
  if (value === 'modal') return 'modal'
  if (value && value !== 'local') {
    throw new Error(
      `Invalid COMPUTE_BACKEND: "${value}". Expected "modal", "local", or unset.`,
    )
  }
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'COMPUTE_BACKEND=modal is required in production. The local FastAPI backend is dev-only.',
    )
  }
  return 'local'
}

function isModalBackend() {
  return getComputeBackend() === 'modal'
}

function getModalUrl() {
  const url = env.MODAL_API_URL
  if (!url) throw new Error('MODAL_API_URL is not configured')
  return url
}

function getLocalApiUrl() {
  return env.LOCAL_API_URL ?? 'http://127.0.0.1:8000'
}

// --- Actions ---

export async function submitJob(
  params: JobParams,
): Promise<{ jobId: string; result?: Record<string, unknown> }> {
  const validated = jobParamsSchema.parse(params)
  // Normalize to uppercase — the backend and algorithm expect uppercase
  // nucleotides. This prevents case-confusion bugs between mixed-case input
  // and the codon tables (which are uppercase).
  validated.CDS = validated.CDS.toUpperCase()

  // Rate limit
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { ok: allowed, resetMs } = await submitLimiter.check(ip)
  if (!allowed) {
    const retrySeconds = Math.ceil(resetMs / 1000)
    throw new Error(
      `Too many job submissions. Please wait ${retrySeconds}s and try again.`,
    )
  }

  const backend = getComputeBackend()
  const optionKeys = Object.keys(validated.options)
  const startMs = performance.now()

  if (backend === 'modal') {
    // Circuit breaker
    if ((await circuitCheck()).tripped) {
      throw new Error(
        'The compute backend is temporarily unavailable. Please try again in a few seconds.',
      )
    }

    // Idempotency: dedupe concurrent identical submissions
    const iKey = await idempotencyKey(validated)
    const existing = await getInflight(iKey)
    if (existing) {
      log.info('job deduplicated', { jobId: existing, name: validated.name })
      return { jobId: existing }
    }

    try {
      const data = await withRetry(
        async () => {
          const response = await fetch(`${getModalUrl()}/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validated),
            signal: AbortSignal.timeout(30_000),
          })
          if (!response.ok) {
            const text = await response.text()
            throw new Error(
              `Modal API error (HTTP ${response.status}): ${text}`,
            )
          }
          return response.json()
        },
        { maxAttempts: 3, baseDelayMs: 500, isRetryable: isTransientError },
      )
      await circuitRecordSuccess()
      await setInflight(iKey, data.call_id)
      log.info('job submitted', {
        jobId: data.call_id,
        backend,
        name: validated.name,
        cdsLength: validated.CDS.length,
        options: optionKeys,
        submitLatencyMs: Math.round(performance.now() - startMs),
        ip,
      })
      return { jobId: data.call_id }
    } catch (err) {
      await circuitRecordFailure()
      await recordDeadLetter({
        timestamp: new Date().toISOString(),
        name: validated.name,
        cdsLength: validated.CDS.length,
        error: err instanceof Error ? err.message : String(err),
        ip,
      })
      throw err
    }
  }

  // Local backend: call FastAPI synchronously and return the result inline.
  const response = await fetch(`${getLocalApiUrl()}/api/py/process-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.detail ?? `Local API error: ${response.statusText}`)
  }
  const result = await response.json()
  const jobId = crypto.randomUUID()
  log.info('job submitted', {
    jobId,
    backend,
    name: validated.name,
    cdsLength: validated.CDS.length,
    options: optionKeys,
    submitLatencyMs: Math.round(performance.now() - startMs),
    ip,
  })
  return { jobId, result }
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const validatedId = jobIdSchema.parse(jobId)

  if (isModalBackend()) {
    const response = await fetch(`${getModalUrl()}/jobs/${validatedId}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Modal API error: ${text}`)
    }
    const result: JobStatusResult = await response.json()
    // Log terminal states for funnel analytics (submit → complete/fail).
    // Intermediate "running" polls are not logged to avoid noise.
    if (result.status === 'completed' || result.status === 'failed') {
      log.info(`job ${result.status}`, { jobId: validatedId })
    }
    return result
  }

  return { status: 'not_found' }
}

export async function cancelJob(jobId: string): Promise<JobStatusResult> {
  const validatedId = jobIdSchema.parse(jobId)

  if (isModalBackend()) {
    const response = await fetch(`${getModalUrl()}/jobs/${validatedId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Modal API error: ${text}`)
    }
    log.info('job cancelled', { jobId: validatedId })
    return response.json()
  }

  return {
    status: 'cancelled',
    error: {
      code: 'cancelled',
      message: 'Job cancelled',
      retriable: true,
    },
  }
}
