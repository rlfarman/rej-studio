/**
 * Transport layer for the compute backend (Modal in production, a local
 * uvicorn in development).
 *
 * Deliberately NOT a `'use server'` module: the status read is served by the
 * `/api/jobs/[id]` route handler (server actions are dispatched one at a time
 * per client, so polling as an action blocks submit/cancel/search), while
 * submit and cancel stay server actions in `./jobs`. Both entry points share
 * the classification, parsing and circuit-breaker logic here.
 *
 * Every response is parsed with the zod mirrors in
 * `../types/backend-contract` before it reaches callers.
 */

import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { redis } from '@/lib/upstash'
import {
  jobStatusResponseSchema,
  jobSubmitResponseSchema,
  processResultSchema,
  type BackendJobError,
  type BackendProcessResult,
  type JobErrorCode,
  type JobStatusResponse,
} from '@/features/design-tool/types/backend-contract'
import type { ProcessOptions } from '@/features/design-tool/types/backend-contract'
import { designToolCopy } from '@/features/design-tool/copy'

const log = createLogger('jobs')
const copy = designToolCopy.jobErrors

/** Same shape the backend sends (see `jobErrorSchema`). */
export type JobError = BackendJobError

/**
 * Expected failures are returned, not thrown: Next replaces thrown
 * server-action messages with a generic digest in production, which would
 * turn "wait 12s" into "An error occurred in the Server Components render".
 * Only bugs throw.
 */
export type JobActionResult<T> =
  { ok: true; data: T } | { ok: false; error: JobError }

export function jobError(
  code: JobErrorCode,
  message: string,
  retriable: boolean,
): { ok: false; error: JobError } {
  return { ok: false, error: { code, message, retriable } }
}

export interface BackendJobParams {
  CDS: string
  name: string
  options: ProcessOptions
  /**
   * The gene dataset this deployment is serving, for the run record — not a
   * claim about where the sequence came from. Deliberately outside the
   * idempotency key, which identifies the work itself: the same sequence and
   * options are the same job whatever the dataset is called.
   */
  corpus_version?: string | null
}

// --- Backend routing -------------------------------------------------------

type ComputeBackend = 'modal' | 'local'

export function getComputeBackend(): ComputeBackend {
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

// Warn once per process rather than on every request.
let warnedAboutMissingToken = false

/**
 * Auth header for Modal. The token is read straight from `process.env`
 * (rather than `@/lib/env`) so this works whether or not the schema entry
 * has landed yet. A missing token in production is a misconfiguration, but
 * it must not take the app down: Modal answers 401 and we surface that.
 */
function modalHeaders(extra?: Record<string, string>): HeadersInit {
  const token = process.env.MODAL_API_TOKEN
  if (!token) {
    if (
      !warnedAboutMissingToken &&
      process.env.NODE_ENV === 'production' &&
      env.COMPUTE_BACKEND === 'modal'
    ) {
      warnedAboutMissingToken = true
      log.warn('MODAL_API_TOKEN is not set — Modal requests will be rejected')
    }
    return { ...extra }
  }
  return { ...extra, Authorization: `Bearer ${token}` }
}

// --- Circuit breaker -------------------------------------------------------
// Trips after THRESHOLD consecutive *transient* failures (network, 5xx, 429)
// so a burst of invalid submissions — which would fail the same way on every
// instance, for every user — can't take the backend offline for everyone.

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

/** Test seam — resets the in-memory breaker between cases. */
export function resetCircuitForTests() {
  circuitLocal.failures = 0
  circuitLocal.open = false
  circuitLocal.openedAt = 0
}

// --- Idempotency -----------------------------------------------------------
// Hash (CDS, options) to a stable key so a double-submit of identical inputs
// reuses the in-flight job instead of spawning a second worker. The entry is
// cleared as soon as the job stops running (see `clearInflight`), otherwise a
// re-run after a cancel/failure would keep resolving to the dead job id for
// the whole TTL.

const INFLIGHT_TTL_S = 600 // 10 minutes — an upper bound on a Modal run
const inflightLocal = new Map<string, { jobId: string; expiresAt: number }>()

async function idempotencyKey(params: {
  CDS: string
  options: ProcessOptions
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

async function clearInflight(key: string) {
  if (redis) {
    try {
      await redis.del(`inflight:${key}`)
      return
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  inflightLocal.delete(key)
}

/**
 * Reverse lookup used when a job is cancelled through the UI: we know the job
 * id, not the hash it was filed under. The local map is small (bounded by
 * concurrent submissions); with Redis we keep a job→key pointer alongside the
 * forward entry.
 */
async function clearInflightForJob(jobId: string) {
  if (redis) {
    try {
      const key = await redis.get<string>(`inflight-job:${jobId}`)
      if (key) {
        await redis.del(`inflight:${key}`)
        await redis.del(`inflight-job:${jobId}`)
      }
      return
    } catch {
      // Redis unavailable — fall through to local
    }
  }
  for (const [key, entry] of inflightLocal) {
    if (entry.jobId === jobId) inflightLocal.delete(key)
  }
}

async function rememberInflightJob(key: string, jobId: string) {
  await setInflight(key, jobId)
  if (redis) {
    try {
      await redis.set(`inflight-job:${jobId}`, key, { ex: INFLIGHT_TTL_S })
    } catch {
      // Best effort — the forward entry still expires on its own.
    }
  }
}

// --- Failure classification ------------------------------------------------

/** A request that never reached the server can be re-sent safely. */
function isConnectionError(err: unknown): boolean {
  // `fetch` rejects with TypeError when the connection itself fails (DNS,
  // ECONNREFUSED, TLS). AbortError means the request was sent and we stopped
  // waiting — re-POSTing that could start a second Modal job.
  return err instanceof TypeError
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function errorFromStatus(status: number, body: string): JobError {
  if (status === 401 || status === 403) {
    return {
      code: 'unauthorized',
      message: copy.unauthorized,
      retriable: false,
    }
  }
  if (status === 422) {
    return {
      code: 'invalid_input',
      message: extractDetail(body) ?? copy.invalidInput,
      retriable: false,
    }
  }
  if (status === 429) {
    return { code: 'rate_limited', message: copy.busy, retriable: true }
  }
  if (status >= 500) {
    return {
      code: 'backend',
      message: copy.backendUnavailable,
      retriable: true,
    }
  }
  return {
    code: 'backend',
    message: extractDetail(body) ?? copy.backendRejected,
    retriable: false,
  }
}

/** FastAPI puts human-readable failures in `{ detail: ... }`. */
function extractDetail(body: string): string | null {
  if (!body) return null
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
      const detail = (parsed as { detail: unknown }).detail
      if (typeof detail === 'string' && detail.trim()) return detail
    }
  } catch {
    // Not JSON — fall through.
  }
  return null
}

/** 5xx, 429 and connection failures are worth counting against the breaker. */
function isTransientFailure(error: JobError): boolean {
  return (
    error.code === 'network' ||
    error.code === 'rate_limited' ||
    error.code === 'timeout' ||
    (error.code === 'backend' && error.retriable)
  )
}

// --- Submit ----------------------------------------------------------------

export interface SubmitOutcome {
  jobId: string
  /** Local backend only: the optimizer runs inline and answers immediately. */
  result?: BackendProcessResult
}

export async function submitToBackend(
  params: BackendJobParams,
): Promise<JobActionResult<SubmitOutcome>> {
  return getComputeBackend() === 'modal'
    ? submitToModal(params)
    : submitToLocal(params)
}

async function submitToModal(
  params: BackendJobParams,
): Promise<JobActionResult<SubmitOutcome>> {
  if ((await circuitCheck()).tripped) {
    return jobError('backend', copy.backendUnavailable, true)
  }

  const key = await idempotencyKey(params)
  const existing = await getInflight(key)
  if (existing) {
    // Only reuse an entry whose job is still running. A cancelled, failed or
    // expired job must not swallow a deliberate re-run.
    const status = await fetchJobStatus(existing)
    if (status.ok && status.data.status === 'running') {
      log.info('job deduplicated', { jobId: existing, name: params.name })
      return { ok: true, data: { jobId: existing } }
    }
    await clearInflight(key)
    await clearInflightForJob(existing)
  }

  const posted = await postJob(params)
  if (!posted.ok) {
    if (isTransientFailure(posted.error)) await circuitRecordFailure()
    log.error('job submission failed', undefined, {
      name: params.name,
      cdsLength: params.CDS.length,
      code: posted.error.code,
    })
    return posted
  }

  await circuitRecordSuccess()
  await rememberInflightJob(key, posted.data.jobId)
  return posted
}

/**
 * POSTs once. Retries only a connection-level failure, where the request
 * provably never reached Modal — a timeout or a 5xx may already have spawned
 * a worker, and a blind retry would start a duplicate job.
 */
async function postJob(
  params: BackendJobParams,
): Promise<JobActionResult<SubmitOutcome>> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`${getModalUrl()}/jobs`, {
        method: 'POST',
        headers: modalHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return { ok: false, error: errorFromStatus(response.status, body) }
      }
      const parsed = jobSubmitResponseSchema.safeParse(await response.json())
      if (!parsed.success) {
        log.error('unexpected submit response', parsed.error)
        return jobError('backend', copy.unexpectedResponse, false)
      }
      return { ok: true, data: { jobId: parsed.data.call_id } }
    } catch (err) {
      if (isTimeoutError(err)) {
        return jobError('timeout', copy.submitTimeout, true)
      }
      if (isConnectionError(err) && attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        continue
      }
      log.error('job submission threw', err, { name: params.name })
      return jobError('network', copy.unreachable, true)
    }
  }
  return jobError('network', copy.unreachable, true)
}

async function submitToLocal(
  params: BackendJobParams,
): Promise<JobActionResult<SubmitOutcome>> {
  try {
    const response = await fetch(`${getLocalApiUrl()}/api/py/process-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, error: errorFromStatus(response.status, body) }
    }
    const parsed = processResultSchema.safeParse(await response.json())
    if (!parsed.success) {
      log.error('unexpected local result', parsed.error)
      return jobError('backend', copy.unexpectedResponse, false)
    }
    return {
      ok: true,
      data: { jobId: crypto.randomUUID(), result: parsed.data },
    }
  } catch (err) {
    if (isTimeoutError(err))
      return jobError('timeout', copy.submitTimeout, true)
    log.error('local submission failed', err, { name: params.name })
    return jobError('network', copy.unreachable, true)
  }
}

// --- Status ----------------------------------------------------------------

export async function fetchJobStatus(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobActionResult<JobStatusResponse>> {
  if (!isModalBackend()) {
    // The local backend answers inline on submit — there is nothing to poll.
    return { ok: true, data: { status: 'not_found' } }
  }
  try {
    const response = await fetch(`${getModalUrl()}/jobs/${jobId}`, {
      headers: modalHeaders(),
      signal: signal ?? AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, error: errorFromStatus(response.status, body) }
    }
    const parsed = jobStatusResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      log.error('unexpected status response', parsed.error, { jobId })
      return jobError('backend', copy.unexpectedResponse, false)
    }
    // Log terminal states for funnel analytics; "running" polls are noise.
    if (parsed.data.status === 'completed' || parsed.data.status === 'failed') {
      log.info(`job ${parsed.data.status}`, { jobId })
    }
    return { ok: true, data: parsed.data }
  } catch (err) {
    if (isTimeoutError(err))
      return jobError('timeout', copy.statusTimeout, true)
    return jobError('network', copy.unreachable, true)
  }
}

// --- Cancel ----------------------------------------------------------------

export async function cancelOnBackend(
  jobId: string,
): Promise<JobActionResult<JobStatusResponse>> {
  // Whatever the backend says, this job is no longer a candidate for
  // idempotent reuse — otherwise an immediate re-run of the same inputs
  // would resolve to the cancelled job id.
  await clearInflightForJob(jobId)

  if (!isModalBackend()) {
    return {
      ok: true,
      data: {
        status: 'cancelled',
        error: { code: 'cancelled', message: copy.cancelled, retriable: true },
      },
    }
  }

  try {
    const response = await fetch(`${getModalUrl()}/jobs/${jobId}`, {
      method: 'DELETE',
      headers: modalHeaders(),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, error: errorFromStatus(response.status, body) }
    }
    const parsed = jobStatusResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      log.error('unexpected cancel response', parsed.error, { jobId })
      return jobError('backend', copy.unexpectedResponse, false)
    }
    log.info('job cancelled', { jobId })
    return { ok: true, data: parsed.data }
  } catch (err) {
    if (isTimeoutError(err))
      return jobError('timeout', copy.statusTimeout, true)
    return jobError('network', copy.unreachable, true)
  }
}
