import { z } from 'zod'

import {
  CLOUD_REFUSAL_STATUS,
  cloudDesignSubmitSchema,
  isCloudDesignId,
  type CloudAnswer,
  type CloudDesign,
  type CloudDesignSubmitted,
  type CloudRefusalReason,
} from '@/features/design-tool/types/cloud-design'
import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { identify } from './identity'
import { designsCopy } from './copy'
import { withinDesignBudget } from './rate-limit'
import {
  CloudDesignUnavailableError,
  deleteCloudDesign,
  readCloudDesign,
  submitCloudDesign,
} from './service'

/**
 * Submit, read and delete cloud designs, for the design tool's server
 * functions (`features/design-tool/api/cloud-designs.functions.ts`).
 *
 * Plain functions of the request, the env and the call's input, so they run
 * under Vitest. Each checks who is asking first, fail-closed (./identity.ts),
 * then validates the input itself (it arrives as the client sent it), and
 * answers a `CloudAnswer`: the value, or a refusal the client can switch on.
 */

const log = createLogger('designs')

type Refusal = Extract<CloudAnswer<never>, { ok: false }>

function refuse(
  reason: CloudRefusalReason,
  message: string,
  retryAfter?: number,
): Refusal {
  return { ok: false, reason, message, retryAfter }
}

/** The HTTP status for an answer (the server functions send it). */
export function statusOf(answer: CloudAnswer<unknown>, created = false) {
  if (!answer.ok) return CLOUD_REFUSAL_STATUS[answer.reason]
  return created ? 202 : 200
}

/**
 * Runs `work` for a caller who has proved who they are. A Workflow binding
 * that is only briefly unavailable is `busy` (the client tries again); any
 * other failure is logged and `failed`.
 */
async function asCaller<T>(
  request: Request,
  env: ServerEnv,
  what: string,
  work: (owner: string) => Promise<CloudAnswer<T>>,
): Promise<CloudAnswer<T>> {
  const identity = await identify(request, env)
  if (!identity.ok) {
    return refuse(
      identity.status === 401 ? 'unauthorized' : 'unavailable',
      identity.message,
    )
  }
  try {
    return await work(identity.owner)
  } catch (error) {
    if (error instanceof CloudDesignUnavailableError) {
      log.warn(`${what}: Workflow status unavailable`)
      return refuse('busy', designsCopy.http.busy, 2)
    }
    log.error(what, error, { owner: identity.owner })
    return refuse('failed', designsCopy.http.failed)
  }
}

/** Every Zod complaint, in one line. */
function explain(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.join('.')
      return where ? `${where}: ${issue.message}` : issue.message
    })
    .join('; ')
}

/** `{ id }` naming a cloud design, or null. */
function designId(input: unknown): string | null {
  const id = (input as { id?: unknown } | null)?.id
  return typeof id === 'string' && isCloudDesignId(id) ? id : null
}

/**
 * Starts a design, or finds the identical one already submitted
 * (`existing`). The input is checked by the form's own schema, so the
 * Worker refuses exactly what the form does.
 */
export function submitDesign(
  request: Request,
  env: ServerEnv,
  input: unknown,
): Promise<CloudAnswer<CloudDesignSubmitted>> {
  return asCaller(request, env, 'cloud design submit failed', async (owner) => {
    const parsed = cloudDesignSubmitSchema.safeParse(input)
    if (!parsed.success) {
      return refuse('invalid', designsCopy.http.invalid(explain(parsed.error)))
    }
    const outcome = await submitCloudDesign(env, {
      ...parsed.data,
      owner,
      spend: () => withinDesignBudget(env, owner),
    })
    if (!outcome.ok) {
      return outcome.reason === 'rate_limited'
        ? refuse('rate_limited', outcome.message, 60)
        : refuse(outcome.reason, outcome.message)
    }
    const { id, status, existing } = outcome
    return { ok: true, data: { id, status, existing } }
  })
}

/** Reads a design: anyone signed in may (see "Who may do what" in ./service.ts). */
export function readDesign(
  request: Request,
  env: ServerEnv,
  input: unknown,
): Promise<CloudAnswer<CloudDesign>> {
  return asCaller(request, env, 'cloud design read failed', async (owner) => {
    const id = designId(input)
    if (!id) return refuse('not_found', designsCopy.http.badId)
    const design = await readCloudDesign(env, id, owner)
    return design
      ? { ok: true, data: design }
      : refuse('not_found', designsCopy.http.notFound)
  })
}

/** Deletes a design and its stored result: its owner only. */
export function deleteDesign(
  request: Request,
  env: ServerEnv,
  input: unknown,
): Promise<CloudAnswer<null>> {
  return asCaller(request, env, 'cloud design delete failed', async (owner) => {
    const id = designId(input)
    if (!id) return refuse('not_found', designsCopy.http.badId)
    switch (await deleteCloudDesign(env, id, owner)) {
      case 'deleted':
        return { ok: true, data: null }
      case 'not_found':
        return refuse('not_found', designsCopy.http.notFound)
      case 'forbidden':
        return refuse('forbidden', designsCopy.http.notOwner)
      case 'not_started':
        return refuse('not_started', designsCopy.http.notStarted, 5)
    }
  })
}
