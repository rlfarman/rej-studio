import {
  CLOUD_DESIGN_ERROR_RETENTION_DAYS,
  CLOUD_DESIGN_MAX_BASES,
  CLOUD_DESIGN_RETENTION_DAYS,
  type CloudDesign,
  type CloudDesignStatus,
} from '@/features/design-tool/types/cloud-design'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import type { JobError } from '@/features/design-tool/types/job-result'
import { processResultSchema } from '@/features/design-tool/types/optimizer-contract'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'
import { OPTIMIZER_WASM_DIGEST } from '@/features/design-tool/workers/optimizer-asset.generated'
import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { designsCopy } from './copy'
import { cloudDesignId } from './id'
import type {
  CloudDesignOutput,
  CloudDesignParams,
  OptimizerRequest,
} from './run'

/**
 * Cloud designs on the Workflow binding: submit, read and delete, shared by
 * `/api/designs` (./handler.ts) and the MCP endpoint's hand-off.
 *
 * ## Who may do what
 *
 * - **Submitting** needs an identity, which becomes the owner, and spends the
 *   owner's budget — but only when a run actually starts. An identical request
 *   gets the existing design back without spending anything.
 * - **Reading** needs no ownership check. An id is the hash of the request
 *   (./id.ts), so whoever holds one already knows the input, or was handed the
 *   id by someone who did; and the output is a deterministic function of that
 *   input and the optimizer build, which they could compute themselves. A
 *   read reveals nothing the id does not already imply, which is what lets a
 *   `?job=` link work for anyone signed in to the lab, and lets two people who
 *   submit the same design share one run.
 * - **Deleting** is owner-only, because it destroys something: the stored
 *   result someone else may still be relying on.
 */

const log = createLogger('designs')

/** How long a subscription is given to deliver an instance's start event. */
const PARAMS_TIMEOUT_MS = 1500

export type DesignWorkflow = Workflow<CloudDesignParams>

// ── Submitting ───────────────────────────────────────────────────────────

export type SubmitOutcome =
  | { ok: true; id: string; status: CloudDesignStatus; existing: boolean }
  | {
      ok: false
      reason: 'unavailable' | 'too_large' | 'rate_limited'
      message: string
    }

interface SubmitInput {
  /** Validated by the form's schema already. */
  values: FormValues
  seed?: number
  owner: string
  /**
   * Spends one unit of the owner's budget; false refuses. Called only when a
   * run is about to start, never for a design that already exists.
   */
  spend: () => Promise<boolean>
}

/** The optimizer request a form's values (and an optional seed) make. */
export function optimizerRequest(
  values: FormValues,
  seed?: number,
): OptimizerRequest {
  const params = buildJobParams(values)
  return seed === undefined
    ? params
    : { ...params, options: { ...params.options, seed } }
}

export async function submitCloudDesign(
  env: ServerEnv,
  { values, seed, owner, spend }: SubmitInput,
): Promise<SubmitOutcome> {
  const workflow = env.DESIGN_WORKFLOW
  if (!workflow) {
    return {
      ok: false,
      reason: 'unavailable',
      message: designsCopy.http.unavailable,
    }
  }

  const bases = values.codingSequence.length
  if (bases > CLOUD_DESIGN_MAX_BASES) {
    return {
      ok: false,
      reason: 'too_large',
      message: designsCopy.http.tooLong(bases, CLOUD_DESIGN_MAX_BASES),
    }
  }

  const request = optimizerRequest(values, seed)
  const id = await cloudDesignId(request, OPTIMIZER_WASM_DIGEST)

  const existing = await findInstance(workflow, id)
  if (existing) return resubmit(existing, spend)

  if (!(await spend())) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: designsCopy.http.rateLimited,
    }
  }

  try {
    await workflow.create({
      id,
      params: {
        values,
        request,
        owner,
        bases,
        submittedAt: new Date().toISOString(),
      },
      retention: {
        successRetention: `${CLOUD_DESIGN_RETENTION_DAYS} days`,
        errorRetention: `${CLOUD_DESIGN_ERROR_RETENTION_DAYS} days`,
      },
    })
    log.info('cloud design submitted', { id, owner, bases })
    return { ok: true, id, status: 'queued', existing: false }
  } catch (error) {
    // Two identical submissions raced: the other one created it between our
    // lookup and our create. Theirs is ours too (the id is the request), so
    // answer with it rather than failing.
    if (!isAlreadyExists(error)) throw error
    const raced = await findInstance(workflow, id)
    if (!raced) throw error
    return resubmit(raced, async () => true)
  }
}

/**
 * An identical request arrived for an instance that already exists. Finished
 * and in-progress designs are returned as they are. A design that failed in a
 * way a re-run could fix (a transient failure, or a stopped run) is restarted
 * in place; one that would fail the same way again (too large, invalid,
 * deterministic optimizer refusal) is returned failed, not re-run.
 */
async function resubmit(
  instance: WorkflowInstance,
  spend: () => Promise<boolean>,
): Promise<SubmitOutcome> {
  const { status, error } = await instance.status()
  const state = cloudStatus(status)
  const failure =
    state === 'failed'
      ? status === 'terminated'
        ? terminatedFailure()
        : describeFailure(error)
      : null
  if (!failure?.retriable) {
    return { ok: true, id: instance.id, status: state, existing: true }
  }
  if (!(await spend())) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: designsCopy.http.rateLimited,
    }
  }
  await instance.restart()
  log.info('cloud design restarted', { id: instance.id, after: failure.code })
  return { ok: true, id: instance.id, status: 'queued', existing: true }
}

// ── Reading ──────────────────────────────────────────────────────────────

/**
 * A cloud design as its readers see it, or null when there is no such
 * instance (never submitted, deleted, or past retention). See the module
 * comment for why reads need no ownership check; `caller` only fills in
 * `ownedByCaller`.
 */
export async function readCloudDesign(
  env: ServerEnv,
  id: string,
  caller?: string,
): Promise<CloudDesign | null> {
  const workflow = env.DESIGN_WORKFLOW
  if (!workflow) return null
  const instance = await findInstance(workflow, id)
  if (!instance) return null

  const snapshot = await instance.status()
  const status = cloudStatus(snapshot.status)
  const described = (
    meta: Omit<CloudDesignParams, 'request'> | null,
  ): CloudDesign => ({
    id,
    status,
    ...(meta
      ? {
          name: meta.values.name,
          bases: meta.bases,
          submittedAt: meta.submittedAt,
          owner: meta.owner,
          values: meta.values,
          ...(caller === undefined
            ? {}
            : { ownedByCaller: meta.owner === caller }),
        }
      : {}),
  })

  if (status === 'queued') return described(null)

  if (status === 'completed') {
    const output = snapshot.output as CloudDesignOutput | undefined
    if (!output) return described(await startedParams(instance))
    const result = await loadResult(env, output)
    return result
      ? { ...described(output), result }
      : {
          ...described(output),
          status: 'failed',
          error: {
            code: 'backend',
            message: designsCopy.failure.resultMissing,
            retriable: true,
          },
        }
  }

  const meta = await startedParams(instance)
  if (status === 'running') return described(meta)
  return {
    ...described(meta),
    error:
      snapshot.status === 'terminated'
        ? terminatedFailure()
        : describeFailure(snapshot.error),
  }
}

async function loadResult(env: ServerEnv, output: CloudDesignOutput) {
  if ('result' in output) return output.result
  const object = await env.DESIGN_RESULTS?.get(output.resultKey)
  if (!object) {
    log.error('cloud design result missing from R2', undefined, {
      key: output.resultKey,
    })
    return null
  }
  const parsed = processResultSchema.safeParse(await object.json())
  return parsed.success ? parsed.data : null
}

// ── Deleting ─────────────────────────────────────────────────────────────

export type DeleteOutcome =
  | 'deleted'
  | 'not_found'
  | 'forbidden'
  | 'not_started'

/** Deletes a design and its stored result, if `caller` owns it. */
export async function deleteCloudDesign(
  env: ServerEnv,
  id: string,
  caller: string,
): Promise<DeleteOutcome> {
  const workflow = env.DESIGN_WORKFLOW
  if (!workflow) return 'not_found'
  const instance = await findInstance(workflow, id)
  if (!instance) return 'not_found'

  const snapshot = await instance.status()
  const output = snapshot.output as CloudDesignOutput | undefined
  const owner = output?.owner ?? (await startedParams(instance))?.owner
  // A queued instance has not started, so its params are not readable yet;
  // refusing is safer than deleting on a guess.
  if (!owner) return 'not_started'
  if (owner !== caller) return 'forbidden'

  await instance.delete()
  if (output && 'resultKey' in output) {
    await env.DESIGN_RESULTS?.delete(output.resultKey)
  }
  log.info('cloud design deleted', { id, owner })
  return 'deleted'
}

// ── Workflow plumbing ────────────────────────────────────────────────────

/** The instance with this id, or null when there is none. */
async function findInstance(
  workflow: DesignWorkflow,
  id: string,
): Promise<WorkflowInstance | null> {
  try {
    return await workflow.get(id)
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/**
 * An instance's params, read from its start event. The binding has no other
 * way to read them back, and a queued instance has no start event yet, so
 * this gives up after a moment and returns null.
 */
async function startedParams(
  instance: WorkflowInstance,
): Promise<Omit<CloudDesignParams, 'request'> | null> {
  let subscription: WorkflowInstanceSubscription | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    subscription = await instance.subscribe({
      cursor: 0,
      filter: ['workflow_started'],
    })
    const next = await Promise.race([
      subscription.next(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), PARAMS_TIMEOUT_MS)
      }),
    ])
    const event = next && !next.done ? next.value : null
    if (event?.type !== 'workflow_started') return null
    const params = event.params as CloudDesignParams | undefined
    return params ?? null
  } catch (error) {
    log.warn('could not read a cloud design’s params', {
      id: instance.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return null
  } finally {
    clearTimeout(timer)
    subscription?.[Symbol.dispose]()
  }
}

/** Folds a Workflow's states into the four a design can be in. */
export function cloudStatus(
  status: InstanceStatus['status'],
): CloudDesignStatus {
  switch (status) {
    case 'complete':
      return 'completed'
    case 'errored':
    case 'terminated':
      return 'failed'
    case 'running':
    case 'waiting':
    case 'rollingBack':
      return 'running'
    // 'queued', 'paused', 'waitingForPause', 'unknown': not under way.
    default:
      return 'queued'
  }
}

/**
 * Why an errored instance failed, from the error the Workflow recorded.
 *
 * - The CPU limit: the runtime kills the step with "exceeded CPU time limit".
 *   It would happen again on a re-run, so it is not retriable; the design
 *   belongs in the browser, which has no limit.
 * - The step's own failures (./run.ts) carry their code as a message prefix,
 *   `code: message` — a NonRetryableError's name does not survive to
 *   `status()`, its message does. All are deterministic.
 * - Anything else is the platform's (an evicted isolate, a lost R2 write) and
 *   a re-run may well succeed, so it is retriable: resubmitting restarts it.
 */
export function describeFailure(
  error: { name?: string; message?: string } | undefined,
): JobError {
  const message = error?.message ?? ''
  if (/exceeded\s*cpu|cpu time limit|exceededCpu/i.test(message)) {
    return {
      code: 'too_large',
      message: designsCopy.failure.tooLarge,
      retriable: false,
    }
  }
  const coded =
    /^(?:\w*Error:\s*)?(invalid_input|optimizer_failed|result_too_large):\s*([\s\S]*)$/.exec(
      message,
    )
  if (coded) {
    const [, code, detail = ''] = coded
    if (code === 'invalid_input') {
      return { code: 'invalid_input', message: detail, retriable: false }
    }
    return {
      code: 'backend',
      message:
        code === 'result_too_large'
          ? designsCopy.failure.resultTooLarge
          : detail,
      retriable: false,
    }
  }
  return {
    code: 'backend',
    message: designsCopy.failure.transient,
    retriable: true,
  }
}

function terminatedFailure(): JobError {
  return {
    code: 'backend',
    message: designsCopy.failure.terminated,
    retriable: true,
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** `create()` on an id still within retention: the dedupe signal. */
function isAlreadyExists(error: unknown): boolean {
  return /already_exists|already exists/i.test(errorText(error))
}

function isNotFound(error: unknown): boolean {
  return /not_found|not found/i.test(errorText(error))
}
