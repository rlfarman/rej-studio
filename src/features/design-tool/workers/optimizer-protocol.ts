// Messages exchanged with the optimizer worker.
//
// Kept in its own module so the worker and its client agree on the shape
// without the client pulling in the worker's module graph (importing the
// worker file directly would bundle the WebAssembly loader into the page).

import type { ProcessOptions } from '@/features/design-tool/types/backend-contract'
import type { Species } from '@/lib/bio/species'

/** Sent to the worker to start a design. */
export interface OptimizerRequest {
  type: 'design'
  /** Echoed back on every reply, so a stale run's messages can be ignored. */
  runId: string
  CDS: string
  name: string
  options: ProcessOptions
}

/**
 * Sent to the worker to reverse-translate a protein.
 *
 * The crate owns the codon tables, so this is the only way to get DNA from a
 * protein — and the form needs that DNA before a design runs, because the
 * splice slider places the split on DNA positions.
 */
export interface ReverseTranslateRequest {
  type: 'reverse-translate'
  runId: string
  protein: string
  species: Species
}

/** Everything the worker accepts. */
export type OptimizerMessage = OptimizerRequest | ReverseTranslateRequest

/** Progress tick while the design runs. */
interface OptimizerProgress {
  type: 'progress'
  runId: string
  /** 0 to 1. */
  fraction: number
  stage: string
}

/** The finished design, as the backend contract's `ProcessResult` JSON. */
interface OptimizerResult {
  type: 'result'
  runId: string
  result: unknown
}

/** The DNA a protein reverse-translates to. */
interface OptimizerReverseTranslated {
  type: 'reverse-translated'
  runId: string
  CDS: string
}

/** The run failed. `code` mirrors the server's job error codes. */
interface OptimizerFailure {
  type: 'error'
  runId: string
  code: 'invalid_input' | 'backend' | 'unknown'
  message: string
}

export type OptimizerResponse =
  | OptimizerProgress
  | OptimizerResult
  | OptimizerReverseTranslated
  | OptimizerFailure
