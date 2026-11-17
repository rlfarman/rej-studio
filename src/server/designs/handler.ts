import { z } from 'zod'

import {
  cloudDesignSubmitSchema,
  isCloudDesignId,
  type CloudDesignSubmitted,
} from '@/features/design-tool/types/cloud-design'
import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { identify, type Identity } from './identity'
import { designsCopy } from './copy'
import { withinDesignBudget } from './rate-limit'
import {
  CloudDesignUnavailableError,
  deleteCloudDesign,
  readCloudDesign,
  submitCloudDesign,
} from './service'

/**
 * `/api/designs`: submit, read and delete cloud designs, for the design tool.
 *
 * Behind the passcode gate like the rest of the app (unlike `/api/mcp`), and
 * checked here as well, fail-closed (./identity.ts). Every answer is JSON and
 * `no-store`: a design is someone's unpublished sequence, so no cache between
 * here and the browser may keep a copy.
 */

const log = createLogger('designs')

/**
 * A 45 kb sequence is ~45 KB of JSON, and the form sends it at most twice
 * (the DNA, and the protein it came from). Anything much bigger is not a
 * design request.
 */
const MAX_BODY_BYTES = 256 * 1024

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...headers },
  })
}

function refuse(
  status: number,
  message: string,
  headers: Record<string, string> = {},
) {
  return json({ error: message }, status, headers)
}

/** Seconds a client is asked to wait after a transient Workflow failure. */
const BUSY_RETRY_AFTER = '2'

/**
 * A failure while handling a design: 503 with `retry-after` when the Workflow
 * binding is only briefly unavailable (the client polls again), 500 otherwise.
 */
function refuseFailure(
  error: unknown,
  what: string,
  context: Record<string, unknown>,
) {
  if (error instanceof CloudDesignUnavailableError) {
    log.warn(`${what}: Workflow status unavailable`, context)
    return refuse(503, designsCopy.http.busy, {
      'retry-after': BUSY_RETRY_AFTER,
    })
  }
  log.error(what, error, context)
  return refuse(500, designsCopy.http.failed)
}

function refuseIdentity(identity: Extract<Identity, { ok: false }>) {
  return refuse(identity.status, identity.message)
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

/** `POST /api/designs` */
export async function handleCreateDesign(
  request: Request,
  env: ServerEnv,
): Promise<Response> {
  const identity = await identify(request, env)
  if (!identity.ok) return refuseIdentity(identity)

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) {
    return refuse(413, designsCopy.http.bodyTooLarge)
  }
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) {
    return refuse(413, designsCopy.http.bodyTooLarge)
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return refuse(400, designsCopy.http.badJson)
  }
  // The form's own schema, so the Worker refuses exactly what the form does.
  const parsed = cloudDesignSubmitSchema.safeParse(body)
  if (!parsed.success) {
    return refuse(400, designsCopy.http.invalid(explain(parsed.error)))
  }

  try {
    const outcome = await submitCloudDesign(env, {
      values: parsed.data.values,
      seed: parsed.data.seed,
      owner: identity.owner,
      spend: () => withinDesignBudget(env, identity.owner),
    })
    if (!outcome.ok) {
      switch (outcome.reason) {
        case 'too_large':
          return refuse(413, outcome.message)
        case 'rate_limited':
          return refuse(429, outcome.message, { 'retry-after': '60' })
        case 'unavailable':
          return refuse(503, outcome.message)
      }
    }
    const answer: CloudDesignSubmitted = {
      id: outcome.id,
      status: outcome.status,
      existing: outcome.existing,
    }
    return json(answer, outcome.existing ? 200 : 202, {
      location: `/api/designs/${outcome.id}`,
    })
  } catch (error) {
    return refuseFailure(error, 'cloud design submit failed', {
      owner: identity.owner,
    })
  }
}

/** `GET /api/designs/:id` */
export async function handleGetDesign(
  request: Request,
  env: ServerEnv,
  id: string,
): Promise<Response> {
  const identity = await identify(request, env)
  if (!identity.ok) return refuseIdentity(identity)
  if (!isCloudDesignId(id)) return refuse(404, designsCopy.http.badId)

  try {
    // No ownership check: see "Who may do what" in ./service.ts.
    const design = await readCloudDesign(env, id, identity.owner)
    if (!design) return refuse(404, designsCopy.http.notFound)
    return json(design)
  } catch (error) {
    return refuseFailure(error, 'cloud design read failed', { id })
  }
}

/** `DELETE /api/designs/:id`: the owner only. */
export async function handleDeleteDesign(
  request: Request,
  env: ServerEnv,
  id: string,
): Promise<Response> {
  const identity = await identify(request, env)
  if (!identity.ok) return refuseIdentity(identity)
  if (!isCloudDesignId(id)) return refuse(404, designsCopy.http.badId)

  try {
    const outcome = await deleteCloudDesign(env, id, identity.owner)
    switch (outcome) {
      case 'deleted':
        return new Response(null, {
          status: 204,
          headers: { 'cache-control': 'no-store' },
        })
      case 'not_found':
        return refuse(404, designsCopy.http.notFound)
      case 'forbidden':
        return refuse(403, designsCopy.http.notOwner)
      case 'not_started':
        return refuse(409, designsCopy.http.notStarted, { 'retry-after': '5' })
    }
  } catch (error) {
    return refuseFailure(error, 'cloud design delete failed', { id })
  }
}
