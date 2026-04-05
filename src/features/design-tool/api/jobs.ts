'use server'

// --- Compute backend actions ---
// Set COMPUTE_BACKEND=modal to use Modal, otherwise falls back to local FastAPI.

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

function isModalBackend() {
  return process.env.COMPUTE_BACKEND === 'modal'
}

function getModalUrl() {
  const url = process.env.MODAL_API_URL
  if (!url) throw new Error('MODAL_API_URL is not configured')
  return url
}

function getLocalApiUrl() {
  // In dev, hit uvicorn directly. In prod, hit the app's own URL (rewrites
  // handle routing to /api/ on Vercel). On Cloudflare this path is unused
  // because COMPUTE_BACKEND=modal is required (no Python runtime).
  if (process.env.NODE_ENV === 'development') {
    return process.env.LOCAL_API_URL ?? 'http://127.0.0.1:8000'
  }
  // APP_URL is the generic, host-agnostic setting. Fall back to VERCEL_URL
  // so existing Vercel deploys keep working without extra env config.
  const appUrl = process.env.APP_URL
  if (appUrl) return appUrl.startsWith('http') ? appUrl : `https://${appUrl}`
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`
  return 'http://127.0.0.1:3000'
}

export async function submitJob(
  params: JobParams,
): Promise<{ jobId: string; result?: Record<string, unknown> }> {
  if (isModalBackend()) {
    const response = await fetch(`${getModalUrl()}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
    body: JSON.stringify(params),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.detail ?? `Local API error: ${response.statusText}`)
  }
  const result = await response.json()
  return { jobId: crypto.randomUUID(), result }
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  if (isModalBackend()) {
    const response = await fetch(`${getModalUrl()}/jobs/${jobId}`)
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
  if (isModalBackend()) {
    const response = await fetch(`${getModalUrl()}/jobs/${jobId}`, {
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
