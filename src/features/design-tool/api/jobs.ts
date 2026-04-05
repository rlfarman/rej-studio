'use server'

// --- Compute backend actions ---
// In production, COMPUTE_BACKEND=modal is required on every host (Vercel and
// Cloudflare). The local FastAPI backend is a dev-only convenience: in dev
// you can set COMPUTE_BACKEND=local (or leave it unset) to hit uvicorn at
// http://127.0.0.1:8000, and COMPUTE_BACKEND=modal still works too.

import { z } from 'zod'

// Server-action input validation. Hostile clients can craft any payload;
// validate at the trust boundary even though in-app call-sites are typed.
const jobParamsSchema = z.object({
  CDS: z
    .string()
    .min(1)
    .max(50000)
    .regex(/^[ACGTUacgtu]+$/, 'Invalid characters in coding sequence.'),
  name: z.string().min(1).max(250),
  options: z.record(z.string(), z.unknown()),
})

const jobIdSchema = z
  .string()
  .min(1)
  .max(200)
  // Modal FunctionCall IDs are opaque tokens; keep the character class tight.
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

type ComputeBackend = 'modal' | 'local'

function getComputeBackend(): ComputeBackend {
  const value = process.env.COMPUTE_BACKEND
  if (value === 'modal') return 'modal'
  if (value && value !== 'local') {
    throw new Error(
      `Invalid COMPUTE_BACKEND: "${value}". Expected "modal", "local", or unset.`,
    )
  }
  // "local" (or unset) is only valid in dev — there is no Python runtime in
  // production on either Vercel or Cloudflare.
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
  const url = process.env.MODAL_API_URL
  if (!url) throw new Error('MODAL_API_URL is not configured')
  return url
}

function getLocalApiUrl() {
  // Dev-only: hit uvicorn directly. getComputeBackend() guarantees we only
  // reach this in dev (NODE_ENV === 'development').
  return process.env.LOCAL_API_URL ?? 'http://127.0.0.1:8000'
}

export async function submitJob(
  params: JobParams,
): Promise<{ jobId: string; result?: Record<string, unknown> }> {
  const validated = jobParamsSchema.parse(params)

  if (isModalBackend()) {
    const response = await fetch(`${getModalUrl()}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validated),
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Modal API error: ${text}`)
    }
    const data = await response.json()
    return { jobId: data.call_id }
  }

  // Local backend: call FastAPI synchronously and return the result inline.
  // No polling needed — the result is available immediately. The jobId is
  // server-minted here so the client has a single, stable identity (used for
  // URL state + history) regardless of which backend ran the job.
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
    const response = await fetch(`${getModalUrl()}/jobs/${validatedId}`)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Modal API error: ${text}`)
    }
    return response.json()
  }

  // Local backend: result was returned inline from submitJob, so this
  // should not be called. Return not_found as a safeguard.
  return { status: 'not_found' }
}

export async function cancelJob(jobId: string): Promise<JobStatusResult> {
  const validatedId = jobIdSchema.parse(jobId)

  if (isModalBackend()) {
    const response = await fetch(`${getModalUrl()}/jobs/${validatedId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Modal API error: ${text}`)
    }
    return response.json()
  }

  // Local backend runs synchronously, so there's nothing to cancel.
  return {
    status: 'cancelled',
    error: {
      code: 'cancelled',
      message: 'Job cancelled',
      retriable: true,
    },
  }
}
