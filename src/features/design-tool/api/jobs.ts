'use server'

// --- Compute backend actions ---
// Submit and cancel are server actions (they mutate). Status polling is NOT:
// Next dispatches server actions one at a time per client, so a 0.5–2s poll
// loop would queue behind (and delay) submits, cancels and searches. Polling
// goes through the `/api/jobs/[id]` route handler instead.
//
// In production, COMPUTE_BACKEND=modal is required (Vercel has no Python
// runtime). The local FastAPI backend is a dev-only convenience.

import { z } from 'zod'
import { getRequestRateLimitKey } from '@/lib/client-ip'
import { createUpstashRateLimiter } from '@/lib/upstash'
import { createLogger } from '@/lib/logger'
import { requireSession } from '@/lib/auth/require-session'
import { getCorpusVersion } from '@/features/design-tool/api/corpus-version'
import {
  cancelOnBackend,
  getComputeBackend,
  jobError,
  submitToBackend,
  type JobActionResult,
  type SubmitOutcome,
} from '@/features/design-tool/api/job-backend'
import {
  processOptionsSchema,
  type JobStatusResponse,
} from '@/features/design-tool/types/backend-contract'
import { dnaSequenceSchema } from '@/features/design-tool/types/form-schema'
import { designToolCopy } from '@/features/design-tool/copy'

const log = createLogger('jobs')
const copy = designToolCopy.jobErrors

// --- Input validation ---
// The CDS is validated with the same rules as the form (frame, start/stop
// codon, no premature stop), so a hand-crafted action call can't push a
// sequence through the optimizer that the UI would have rejected.
const jobParamsSchema = z
  .object({
    CDS: dnaSequenceSchema,
    name: z.string().trim().min(1).max(250),
    options: processOptionsSchema,
  })
  // Same cross-field checks as ProcessRequest in python/contracts.py, so an
  // out-of-range split point fails here with a readable message instead of
  // coming back as a 422 from Modal.
  .superRefine((data, ctx) => {
    const length = data.CDS.length
    const { split_point: splitPoint, selected_wggw_site: site } = data.options
    if (splitPoint != null && splitPoint > length) {
      ctx.addIssue({
        path: ['options', 'split_point'],
        code: z.ZodIssueCode.custom,
        message: copy.splitPointPastEnd(splitPoint, length),
      })
    }
    if (site && site.hexamer_start - 1 + 6 > length) {
      ctx.addIssue({
        path: ['options', 'selected_wggw_site'],
        code: z.ZodIssueCode.custom,
        message: copy.wggwSiteOutsideSequence,
      })
    }
  })

export type JobParams = z.input<typeof jobParamsSchema>

const jobIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid job id.')

// --- Rate limiter ---
// 10 job submissions per minute per IP. Prevents a single caller from burning
// through Modal compute budget.
const submitLimiter = createUpstashRateLimiter({
  prefix: 'jobs',
  maxRequests: 10,
  windowMs: 60_000,
})

// --- Actions ---

export async function submitJob(
  params: JobParams,
): Promise<JobActionResult<SubmitOutcome>> {
  if (!(await hasSession())) {
    return jobError('unauthorized', copy.sessionExpired, false)
  }

  const validated = jobParamsSchema.safeParse(params)
  if (!validated.success) {
    return jobError(
      'invalid_input',
      validated.error.issues[0]?.message ?? copy.invalidInput,
      false,
    )
  }

  // Per session when signed in (a lab shares one IP), otherwise per IP.
  const { ok: allowed, resetMs } = await submitLimiter.check(
    await getRequestRateLimitKey(),
  )
  if (!allowed) {
    return jobError(
      'rate_limited',
      copy.rateLimited(Math.ceil(resetMs / 1000)),
      true,
    )
  }

  const backend = getComputeBackend()
  const startMs = performance.now()
  // The dataset this deployment is serving is named here, where the database
  // is reachable, and recorded by the backend in the run record. It is not a
  // claim about where the sequence came from; see ./corpus-version.ts.
  const outcome = await submitToBackend({
    ...validated.data,
    corpus_version: await getCorpusVersion(),
  })
  if (!outcome.ok) return outcome

  log.info('job submitted', {
    jobId: outcome.data.jobId,
    backend,
    name: validated.data.name,
    cdsLength: validated.data.CDS.length,
    options: Object.keys(validated.data.options),
    submitLatencyMs: Math.round(performance.now() - startMs),
  })
  return outcome
}

export async function cancelJob(
  jobId: string,
): Promise<JobActionResult<JobStatusResponse>> {
  if (!(await hasSession())) {
    return jobError('unauthorized', copy.sessionExpired, false)
  }
  const validatedId = jobIdSchema.safeParse(jobId)
  if (!validatedId.success) {
    return jobError('invalid_input', copy.invalidJobId, false)
  }
  return cancelOnBackend(validatedId.data)
}

/**
 * Server actions are public endpoints addressed by action id, so each one
 * re-checks the session rather than relying on the proxy matcher. The
 * missing-session case is an expected failure, not a bug, so it's returned
 * (a thrown message would be replaced by a digest in production).
 */
async function hasSession(): Promise<boolean> {
  try {
    await requireSession()
    return true
  } catch {
    return false
  }
}
