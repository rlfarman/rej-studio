// The outcome of a design run.

import type { JobErrorCode, jobErrorSchema } from './optimizer-contract'
import type { z } from 'zod'

export type JobError = z.infer<typeof jobErrorSchema>

/** Expected failures are returned, not thrown; only bugs throw. */
export type JobActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: JobError }

export function jobError(
  code: JobErrorCode,
  message: string,
  retriable: boolean,
): { ok: false; error: JobError } {
  return { ok: false, error: { code, message, retriable } }
}
