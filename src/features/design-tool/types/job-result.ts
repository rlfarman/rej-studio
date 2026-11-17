// The result shape every job path returns, server or browser.
//
// Kept apart from `../api/job-backend` because that module reaches for
// `@/lib/env` and Upstash, which are server-only. The in-browser optimizer
// returns the same shape, so the type and its constructor have to be
// importable from client code too.

import type { BackendJobError, JobErrorCode } from './backend-contract'

/** Same shape the backend sends (see `jobErrorSchema`). */
export type JobError = BackendJobError

/**
 * Expected failures are returned, not thrown: Next replaces thrown
 * server-action messages with a generic digest in production, which would
 * turn "wait 12s" into "An error occurred in the Server Components render".
 * Only bugs throw.
 */
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
