'use server'

// --- Compute backend actions ---
// In production, COMPUTE_BACKEND=modal is required on every host (Vercel and
// Cloudflare). The local FastAPI backend is a dev-only convenience: in dev
// you can set COMPUTE_BACKEND=local (or leave it unset) to hit uvicorn at
// http://127.0.0.1:8000, and COMPUTE_BACKEND=modal still works too.

import { z } from 'zod'
import { headers } from 'next/headers'
import { createRateLimiter } from '@/lib/rate-limit'
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

export interface JobParams {
  CDS: string
  name: string
  options: Record<string, unknown>
}

export interface JobErrorPayload {
  code: string
  message: string
  retriable: boolean
}

export interface JobStatusResult {
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'not_found'
  result?: Record<string, unknown>
  error?: JobErrorPayload
  progress?: number
  stage?: string
}

// --- Rate limiter ---
// 10 job submissions per minute per IP. Prevents a single caller from burning
// through Modal compute budget.
const submitLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })

// --- Idempotency ---
// Hash (CDS, options) to a stable key. If the same job is submitted twice
// before the first resolves, return the existing call_id instead of spawning
// a second worker.
const inflightJobs = new Map<string, { jobId: string; expiresAt: number }>()
const INFLIGHT_TTL = 10 * 60_000 // 10 minutes

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

function getInflight(key: string): string | null {
  const entry = inflightJobs.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    inflightJobs.delete(key)
    return null
  }
  return entry.jobId
}

function setInflight(key: string, jobId: string) {
  inflightJobs.set(key, { jobId, expiresAt: Date.now() + INFLIGHT_TTL })
}

// --- Circuit breaker ---
// Trips after THRESHOLD consecutive failures to Modal. When open, fail fast
// with a clear message instead of hanging 30s. Resets after RESET_MS.
const circuit = {
  failures: 0,
  open: false,
  openedAt: 0,
  THRESHOLD: 5,
  RESET_MS: 30_000,
}

function circuitCheck(): { tripped: boolean } {
  if (!circuit.open) return { tripped: false }
  if (Date.now() - circuit.openedAt > circuit.RESET_MS) {
    // Half-open: allow one request through to test recovery.
    circuit.open = false
    circuit.failures = 0
    return { tripped: false }
  }
  return { tripped: true }
}

function circuitRecordSuccess() {
  circuit.failures = 0
  circuit.open = false
}

function circuitRecordFailure() {
  circuit.failures++
  if (circuit.failures >= circuit.THRESHOLD) {
    circuit.open = true
    circuit.openedAt = Date.now()
  }
}

// --- Dead letter queue ---
// Tracks failed Modal submissions in-memory so they can be inspected via the
// health endpoint. Capped at MAX_DLQ entries to bound memory. In a future
// iteration this could persist to the DB or an external queue.

interface DeadLetterEntry {
  timestamp: string
  name: string
  cdsLength: number
  error: string
  ip: string
}

const MAX_DLQ = 50
const deadLetterQueue: DeadLetterEntry[] = []

function recordDeadLetter(entry: DeadLetterEntry) {
  log.error('job submission failed — added to DLQ', undefined, {
    name: entry.name,
    cdsLength: entry.cdsLength,
  })
  deadLetterQueue.push(entry)
  if (deadLetterQueue.length > MAX_DLQ) deadLetterQueue.shift()
}

/** Expose DLQ for the health/admin endpoint. */
export function getDeadLetterQueue(): readonly DeadLetterEntry[] {
  return deadLetterQueue
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
  const { ok: allowed } = submitLimiter.check(ip)
  if (!allowed) {
    throw new Error(
      'Too many job submissions. Please wait a moment and try again.',
    )
  }

  if (isModalBackend()) {
    // Circuit breaker
    if (circuitCheck().tripped) {
      throw new Error(
        'The compute backend is temporarily unavailable. Please try again in a few seconds.',
      )
    }

    // Idempotency: dedupe concurrent identical submissions
    const iKey = await idempotencyKey(validated)
    const existing = getInflight(iKey)
    if (existing) {
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
      circuitRecordSuccess()
      setInflight(iKey, data.call_id)
      log.info('job submitted', {
        jobId: data.call_id,
        name: validated.name,
        cdsLength: validated.CDS.length,
      })
      return { jobId: data.call_id }
    } catch (err) {
      circuitRecordFailure()
      recordDeadLetter({
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
  return { jobId: crypto.randomUUID(), result }
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
