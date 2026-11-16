/**
 * Client-side job status read.
 *
 * Hits the `/api/jobs/[id]` route handler (not a server action — those are
 * dispatched one at a time per client, so polling as an action blocks submit,
 * cancel and search) and parses the body with the shared contract schema.
 */

import {
  jobErrorSchema,
  jobStatusResponseSchema,
  type BackendJobError,
  type JobStatusResponse,
} from '@/features/design-tool/types/backend-contract'
import { designToolCopy } from '@/features/design-tool/copy'

const copy = designToolCopy.jobErrors

/** Carries the structured backend error through TanStack Query's error path. */
export class JobStatusError extends Error {
  readonly jobError: BackendJobError

  constructor(jobError: BackendJobError) {
    super(jobError.message)
    this.name = 'JobStatusError'
    this.jobError = jobError
  }
}

export async function fetchJobStatusFromApi(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobStatusResponse> {
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const parsed = jobErrorSchema.safeParse(
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: unknown }).error
        : null,
    )
    throw new JobStatusError(
      parsed.success
        ? parsed.data
        : {
            code: response.status === 401 ? 'unauthorized' : 'network',
            message:
              response.status === 401 ? copy.sessionExpired : copy.unreachable,
            retriable: response.status !== 401,
          },
    )
  }

  const parsed = jobStatusResponseSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new JobStatusError({
      code: 'backend',
      message: copy.unexpectedResponse,
      retriable: false,
    })
  }
  return parsed.data
}
