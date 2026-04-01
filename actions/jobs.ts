'use server'

import { db } from '@/drizzle/db'
import { jobs } from '@/drizzle/schema'
import { desc, sql, eq } from 'drizzle-orm'

interface JobOptions {
  codon_optimize: string | null
  codon_optimize_weight: number
  remove_cryptic_ss: boolean
  remove_cryptic_ss_weight: number
  minimize_CpGs: boolean
  minimize_CpGs_weight: number
  reduce_kmer_complexity: boolean
  reduce_kmer_complexity_weight: number
  enforce_gc: boolean
  stim_5: boolean
  stim_3: boolean
  split_point: number
  ensure_wggw: boolean
  wggw_threshold: number
}

// --- Compute backend actions ---
// Set COMPUTE_BACKEND=modal to use Modal, otherwise falls back to local FastAPI.

export interface JobParams {
  CDS: string
  name: string
  options: Record<string, unknown>
}

export interface JobStatusResult {
  status: 'running' | 'completed' | 'failed' | 'not_found'
  result?: Record<string, unknown>
}

function useModal() {
  return process.env.COMPUTE_BACKEND === 'modal'
}

function getModalUrl() {
  const url = process.env.MODAL_API_URL
  if (!url) throw new Error('MODAL_API_URL is not configured')
  return url
}

function getLocalApiUrl() {
  // In dev, hit uvicorn directly. On Vercel, use the app's own URL (rewrites handle routing).
  if (process.env.NODE_ENV === 'development') {
    return process.env.LOCAL_API_URL ?? 'http://127.0.0.1:8000'
  }
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`
  return 'http://127.0.0.1:3000'
}

export async function submitJob(
  params: JobParams,
): Promise<{ jobId: string; result?: Record<string, unknown> }> {
  if (useModal()) {
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
  // No polling needed — the result is available immediately.
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
  return { jobId: 'local', result }
}

export async function getJobStatus(
  jobId: string,
): Promise<JobStatusResult> {
  if (useModal()) {
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

export const createJob = async ({
  userId,
  name,
  sequence,
  options,
}: {
  userId: string
  name: string
  sequence: string
  options?: JobOptions
}) => {
  try {
    await db.insert(jobs).values({
      userId,
      name,
      sequence,
      options: JSON.stringify(options),
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getRecentJobs = async ({ userId }: { userId: string }) => {
  try {
    return db
      .select({
        id: jobs.id,
        name: jobs.name,
        sequence: sql<string>`substr(${jobs.sequence}, 1, 24)`,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy((t) => desc(t.createdAt))
      .limit(6)
  } catch (error) {
    console.error(error)
    throw error
  }
}
