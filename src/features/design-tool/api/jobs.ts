'use server'

// --- Design jobs, for the browser ---
//
// Server actions are public endpoints, so each one authorizes before doing
// anything. The work itself is in `./jobs-core.ts`, which the MCP endpoint
// calls too; this file is only the session check and the caller's identity.

import { headers } from 'next/headers'

import { requireSession } from '@/lib/auth/require-session'

import {
  type JobCaller,
  type JobParams,
  type JobStatusResult,
  runCancelJob,
  runJobStatus,
  runSubmitJob,
} from './jobs-core'

/** The browser caller: rate limited and logged by client IP. */
async function browserCaller(): Promise<JobCaller> {
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  return { key: ip, label: ip }
}

export async function submitJob(
  params: JobParams,
): Promise<{ jobId: string; result?: Record<string, unknown> }> {
  await requireSession()
  return runSubmitJob(params, await browserCaller())
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  await requireSession()
  return runJobStatus(jobId)
}

export async function cancelJob(jobId: string): Promise<JobStatusResult> {
  await requireSession()
  return runCancelJob(jobId)
}
