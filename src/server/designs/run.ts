// The body of the cloud-design Workflow's one step, kept apart from the
// Workflow class (./workflow.ts) so it runs under plain Vitest: the class
// extends `cloudflare:workers`' WorkflowEntrypoint, which only exists in
// workerd.

import type { CloudDesignStatus } from '@/features/design-tool/types/cloud-design'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import type { ProcessOptions } from '@/features/design-tool/types/optimizer-contract'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { designOnWorker } from '../mcp/optimizer'
import { markDesignStatus } from './records'

/** What the optimizer's `process` is given. Hashed into the id (./id.ts). */
export interface OptimizerRequest {
  CDS: string
  name: string
  options: ProcessOptions
}

/** A Workflow instance's params: everything needed to run and describe it. */
export interface CloudDesignParams {
  /** The form's values, as validated: what a `?job=` link restores. */
  values: FormValues
  /** Exactly what the optimizer runs, derived from `values` (and a seed). */
  request: OptimizerRequest
  /** `session:<id>` for a sign-in, `local` in development, or `mcp:<token name>` for an agent. */
  owner: string
  bases: number
  /** ISO 8601. */
  submittedAt: string
}

/**
 * A finished instance's output: its params' description plus the result, or
 * the R2 key the result was written to when it was too large to return.
 */
export type CloudDesignOutput = Omit<CloudDesignParams, 'request'> & {
  /** Wall time of the design in the Worker. */
  seconds: number
} & ({ result: ProcessResult } | { resultKey: string })

/**
 * A step returns at most 1 MiB. A 45 kb design is a few hundred KB, so this
 * is a backstop, with room under the limit for the JSON around the result.
 */
export const MAX_INLINE_RESULT_BYTES = 900_000

/** Where a large result lives in the DESIGN_RESULTS bucket. */
export function resultKey(id: string): string {
  return `designs/${id}.json`
}

/**
 * A failure that running again would only repeat: the optimizer is
 * deterministic, so a refusal or a crash on this input recurs. The Workflow
 * turns these into NonRetryableErrors whose message starts with the code,
 * which is how a reader tells them apart (./service.ts, `describeFailure`).
 */
export class CloudDesignFailure extends Error {
  readonly code: 'invalid_input' | 'optimizer_failed' | 'result_too_large'

  constructor(code: CloudDesignFailure['code'], message: string) {
    super(message)
    this.name = 'CloudDesignFailure'
    this.code = code
  }
}

const log = createLogger('designs')

/**
 * Notes where the design got to in the account's list (./records.ts), which
 * is where "My cloud designs" reads it from: the step is the one place that
 * learns the outcome without anyone asking for it. The list is an index
 * beside the Workflow, so a failed write is logged and the design carries
 * on. The run the CPU limit kills never reaches the settling write, and its
 * row stays 'running' until something reads the design (./handler.ts).
 */
async function note(
  env: ServerEnv,
  id: string,
  status: CloudDesignStatus,
): Promise<void> {
  const db = env.AUTH_DB
  if (!db) return
  try {
    await markDesignStatus(db, id, status)
  } catch (error) {
    log.error('could not note a cloud design’s status', error, { id, status })
  }
}

interface RunDeps {
  design?: typeof designOnWorker
  /** Waits between R2 attempts; replaced in tests. */
  wait?: (ms: number) => Promise<void>
}

const R2_ATTEMPTS = 3

export async function runCloudDesign(
  id: string,
  params: CloudDesignParams,
  env: ServerEnv,
  deps: RunDeps = {},
): Promise<CloudDesignOutput> {
  await note(env, id, 'running')
  try {
    const output = await runStep(id, params, env, deps)
    await note(env, id, 'completed')
    return output
  } catch (error) {
    // The step is not retried (./workflow.ts), so a throw here is final.
    await note(env, id, 'failed')
    throw error
  }
}

async function runStep(
  id: string,
  params: CloudDesignParams,
  env: ServerEnv,
  { design = designOnWorker, wait = sleep }: RunDeps,
): Promise<CloudDesignOutput> {
  const outcome = await design(params.request)
  if (!outcome.ok) {
    throw new CloudDesignFailure(
      outcome.code === 'invalid_input' ? 'invalid_input' : 'optimizer_failed',
      outcome.message,
    )
  }

  const base = {
    values: params.values,
    owner: params.owner,
    bases: params.bases,
    submittedAt: params.submittedAt,
    seconds: outcome.seconds,
  }
  // Measured as the whole output, which is what the step returns: the inputs
  // ride along with the result.
  const inline = { ...base, result: outcome.result }
  if (byteLength(JSON.stringify(inline)) <= MAX_INLINE_RESULT_BYTES) {
    return inline
  }
  const body = JSON.stringify(outcome.result)

  const bucket = env.DESIGN_RESULTS
  if (!bucket) {
    throw new CloudDesignFailure(
      'result_too_large',
      'the result is over 900 KB and this deployment has no DESIGN_RESULTS bucket to hold it',
    )
  }
  // R2 is the one transient thing in the step. It is retried here rather
  // than by the step, because a step retry would run the optimizer again —
  // minutes of CPU — to repeat a write.
  const key = resultKey(id)
  for (let attempt = 1; ; attempt++) {
    try {
      await bucket.put(key, body, {
        httpMetadata: { contentType: 'application/json' },
      })
      return { ...base, resultKey: key }
    } catch (error) {
      if (attempt >= R2_ATTEMPTS) throw error
      await wait(1000 * 2 ** (attempt - 1))
    }
  }
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
