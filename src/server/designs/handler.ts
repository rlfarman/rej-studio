import { z } from 'zod'

import {
  CLOUD_REFUSAL_STATUS,
  cloudDesignSubmitSchema,
  isCloudDesignId,
  type CloudAnswer,
  type CloudDesign,
  type CloudDesignSubmitted,
  type CloudDesignSummary,
  type CloudRefusalReason,
} from '@/features/design-tool/types/cloud-design'
import { createLogger } from '@/lib/logger'

import type { AccountsRuntime } from '../accounts/auth'
import type { ServerEnv } from '../env'
import { identify, type Account } from './identity'
import { designsCopy } from './copy'
import { withinDesignBudget } from './rate-limit'
import {
  forgetDesign,
  listDesigns,
  markDesignStatus,
  recordDesign,
} from './records'
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
 *
 * Reading needs only the passcode. Submitting, deleting and listing need an
 * account (`account_required` otherwise, which the page answers by offering
 * to sign in): cloud runs are an account feature, and the account owns them.
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
 * Runs `work` for a caller past the passcode, with their account if they are
 * signed in to one. A Workflow binding that is only briefly unavailable is
 * `busy` (the client tries again); any other failure is logged and `failed`.
 */
async function asCaller<T>(
  request: Request,
  env: ServerEnv,
  runtime: AccountsRuntime,
  what: string,
  work: (account: Account | null) => Promise<CloudAnswer<T>>,
): Promise<CloudAnswer<T>> {
  const caller = await identify(request, env, runtime)
  if (!caller.ok) {
    return refuse(
      caller.status === 401 ? 'unauthorized' : 'unavailable',
      caller.message,
    )
  }
  try {
    return await work(caller.account)
  } catch (error) {
    if (error instanceof CloudDesignUnavailableError) {
      log.warn(`${what}: Workflow status unavailable`)
      return refuse('busy', designsCopy.http.busy, 2)
    }
    log.error(what, error, { owner: caller.account?.owner })
    return refuse('failed', designsCopy.http.failed)
  }
}

/** `asCaller` for what only an account may do: `account_required` without one. */
function asAccount<T>(
  request: Request,
  env: ServerEnv,
  runtime: AccountsRuntime,
  what: string,
  work: (account: Account) => Promise<CloudAnswer<T>>,
): Promise<CloudAnswer<T>> {
  return asCaller(request, env, runtime, what, async (account) =>
    account
      ? work(account)
      : refuse('account_required', designsCopy.http.accountRequired),
  )
}

/**
 * Runs a write to the account's design list. The list is an index beside
 * the Workflow, so a failed write is logged and the call still answers
 * with what happened to the design itself.
 */
async function updateRecords(
  what: string,
  write: () => Promise<void>,
): Promise<void> {
  try {
    await write()
  } catch (error) {
    log.error(what, error)
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
  runtime: AccountsRuntime = {},
): Promise<CloudAnswer<CloudDesignSubmitted>> {
  const what = 'cloud design submit failed'
  return asAccount(request, env, runtime, what, async ({ owner }) => {
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
    const db = env.AUTH_DB
    if (db) {
      await updateRecords('could not record a cloud design', () =>
        recordDesign(db, owner, {
          id,
          name: parsed.data.values.name,
          bases: parsed.data.values.codingSequence.length,
          submittedAt: new Date().toISOString(),
          // What submitting just learned: 'queued' for a new run, or
          // wherever an identical one already submitted has got to.
          status,
        }),
      )
    }
    return { ok: true, data: { id, status, existing } }
  })
}

/**
 * Reads a design: anyone past the passcode may, account or not (see "Who may
 * do what" in ./service.ts), so a `?job=` link opens for everyone in the lab.
 */
export function readDesign(
  request: Request,
  env: ServerEnv,
  input: unknown,
  runtime: AccountsRuntime = {},
): Promise<CloudAnswer<CloudDesign>> {
  const what = 'cloud design read failed'
  return asCaller(request, env, runtime, what, async (account) => {
    const id = designId(input)
    if (!id) return refuse('not_found', designsCopy.http.badId)
    // Without an account the caller owns nothing, so `ownedByCaller` is
    // false rather than absent.
    const design = await readCloudDesign(env, id, account?.owner ?? '')
    if (!design) return refuse('not_found', designsCopy.http.notFound)
    // The read knows the design's state, and it is the only thing that does
    // for a run the step could not report on (killed by the CPU limit) or
    // one listed from before the status column. Correcting the index here
    // costs one write and only when it has something new to say.
    const db = env.AUTH_DB
    if (db) {
      await updateRecords('could not note a cloud design’s status', () =>
        markDesignStatus(db, id, design.status),
      )
    }
    return { ok: true, data: design }
  })
}

/**
 * Deletes a design and its stored result: the account that submitted it
 * only. Deleted or already gone, it leaves the account's list too.
 */
export function deleteDesign(
  request: Request,
  env: ServerEnv,
  input: unknown,
  runtime: AccountsRuntime = {},
): Promise<CloudAnswer<null>> {
  const what = 'cloud design delete failed'
  return asAccount(request, env, runtime, what, async ({ owner }) => {
    const id = designId(input)
    if (!id) return refuse('not_found', designsCopy.http.badId)
    const outcome = await deleteCloudDesign(env, id, owner)
    const db = env.AUTH_DB
    if (db && (outcome === 'deleted' || outcome === 'not_found')) {
      await updateRecords('could not forget a cloud design', () =>
        forgetDesign(db, owner, id),
      )
    }
    switch (outcome) {
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

/** The signed-in account's cloud designs, newest first, for any device. */
export function listMyDesigns(
  request: Request,
  env: ServerEnv,
  runtime: AccountsRuntime = {},
): Promise<CloudAnswer<CloudDesignSummary[]>> {
  const what = 'cloud design list failed'
  return asAccount(request, env, runtime, what, async ({ owner }) => {
    const db = env.AUTH_DB
    if (!db) return refuse('unavailable', designsCopy.http.unavailable)
    return { ok: true, data: await listDesigns(db, owner) }
  })
}
