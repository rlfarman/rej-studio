// Messages exchanged with the optimizer worker.
//
// Kept in its own module so the worker and its client agree on the shape
// without the client pulling in the worker's module graph (importing the
// worker file directly would bundle the WebAssembly loader into the page).

import type { ProcessOptions } from '@/features/design-tool/types/backend-contract'

/** Sent to the worker to start a design. */
export interface OptimizerRequest {
  type: 'design'
  /** Echoed back on every reply, so a stale run's messages can be ignored. */
  runId: string
  CDS: string
  name: string
  options: ProcessOptions
}

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

/** The run failed. `code` mirrors the server's job error codes. */
interface OptimizerFailure {
  type: 'error'
  runId: string
  code: 'invalid_input' | 'backend' | 'unknown'
  message: string
}

export type OptimizerResponse =
  OptimizerProgress | OptimizerResult | OptimizerFailure
