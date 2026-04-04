'use server'

// --- Compute backend actions ---
// Set COMPUTE_BACKEND=modal to use Modal, otherwise talks to local FastAPI.
// Both backends expose the same `/jobs` + `/jobs/{call_id}` contract.

export interface JobParams {
  CDS: string
  name: string
  options: Record<string, unknown>
}

export interface JobStatusResult {
  status: 'running' | 'completed' | 'failed' | 'not_found'
  result?: Record<string, unknown>
}

function getBackendUrl() {
  if (process.env.COMPUTE_BACKEND === 'modal') {
    const url = process.env.MODAL_API_URL
    if (!url) throw new Error('MODAL_API_URL is not configured')
    return url
  }
  return process.env.LOCAL_API_URL ?? 'http://127.0.0.1:8000'
}

export async function submitJob(
  params: JobParams,
): Promise<{ jobId: string }> {
  const response = await fetch(`${getBackendUrl()}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Compute backend error: ${text}`)
  }
  const data = await response.json()
  return { jobId: data.call_id }
}

export async function getJobStatus(
  jobId: string,
): Promise<JobStatusResult> {
  const response = await fetch(`${getBackendUrl()}/jobs/${jobId}`)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Compute backend error: ${text}`)
  }
  return response.json()
}
