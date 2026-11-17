import { z } from 'zod'

import {
  cloudDesignSubmitSchema,
  isCloudDesignId,
  type CloudDesign,
  type CloudDesignSubmitted,
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
 * The server side of the design tool's cloud-design server functions
 * (`features/design-tool/api/cloud-designs.functions.ts`): who is asking,
 * what they sent, and submit / read / delete on the Workflow binding.
 *
 * Each piece takes the env and the request as parameters, so it runs under
 * plain Vitest; the server-function file wires them to `cloudflare:workers`
 * and Start's request.
 *
 * A refusal is a thrown `Response` (JSON `{ error }`, `no-store`), which
 * Start sends as it is, status and headers included: 400, 401, 403, 404,
 * 409, 413, 429, and 503 with `retry-after` when the Workflow binding is
 * briefly unavailable (the browser's poller just tries again). Anything
 * else that goes wrong is logged and refused as a plain 500.
 */

const log = createLogger('designs')

/**
 * A 45 kb sequence is ~45 KB of JSON, and the form sends it at most twice
 * (the DNA, and the protein it came from), plus the serialization's own
 * framing. Anything much bigger is not a design request. Enforced before
 * Start reads the body, by the request middleware in src/start.ts.
 */
export const MAX_BODY_BYTES = 256 * 1024

/** Seconds a client is asked to wait after a transient Workflow failure. */
const BUSY_RETRY_AFTER = '2'

/** A refusal, to throw: JSON `{ error }`, never cached. */
function refusal(
  status: number,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: message },
    { status, headers: { 'cache-control': 'no-store', ...headers } },
  )
}

/**
 * Turns a failure into a refusal: 503 with `retry-after` when the Workflow
 * binding is only briefly unavailable, 500 otherwise. A refusal already
 * made passes through.
 */
function refuseFailure(
  error: unknown,
  what: string,
  context: Record<string, unknown>,
): Response {
  if (error instanceof Response) return error
  if (error instanceof CloudDesignUnavailableError) {
    log.warn(`${what}: Workflow status unavailable`, context)
    return refusal(503, designsCopy.http.busy, {
      'retry-after': BUSY_RETRY_AFTER,
    })
  }
  log.error(what, error, context)
  return refusal(500, designsCopy.http.failed)
}

// ── Who, and what ────────────────────────────────────────────────────────

/**
 * The caller's owner key, or a thrown 401/503. Fails closed (./identity.ts):
 * the session is verified here even though the gate already did.
 */
export async function authorize(
  request: Request,
  env: ServerEnv,
): Promise<string> {
  const identity = await identify(request, env)
  if (!identity.ok) throw refusal(identity.status, identity.message)
  return identity.owner
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

/**
 * A submission, checked by the form's own schema so the Worker refuses
 * exactly what the form does; a 400 with the form's reasons otherwise.
 */
export function parseSubmission(
  input: unknown,
): z.infer<typeof cloudDesignSubmitSchema> {
  const parsed = cloudDesignSubmitSchema.safeParse(input)
  if (!parsed.success) {
    throw refusal(400, designsCopy.http.invalid(explain(parsed.error)))
  }
  return parsed.data
}

/**
 * `{ id }` naming a cloud design. Anything that is not one is a 404 rather
 * than a 400, as an unknown id is: either way there is no such design.
 */
export function parseDesignId(input: unknown): { id: string } {
  const id =
    typeof input === 'object' && input !== null && 'id' in input
      ? input.id
      : undefined
  if (typeof id !== 'string' || !isCloudDesignId(id)) {
    throw refusal(404, designsCopy.http.badId)
  }
  return { id }
}

// ── Submit, read, delete ─────────────────────────────────────────────────

/**
 * Starts a design, or finds the identical one already submitted. `created`
 * says which, for the HTTP status (202 for a new run, 200 otherwise).
 */
export async function createDesign(
  env: ServerEnv,
  owner: string,
  { values, seed }: z.infer<typeof cloudDesignSubmitSchema>,
): Promise<{ answer: CloudDesignSubmitted; created: boolean }> {
  try {
    const outcome = await submitCloudDesign(env, {
      values,
      seed,
      owner,
      spend: () => withinDesignBudget(env, owner),
    })
    if (!outcome.ok) {
      switch (outcome.reason) {
        case 'too_large':
          throw refusal(413, outcome.message)
        case 'rate_limited':
          throw refusal(429, outcome.message, { 'retry-after': '60' })
        case 'unavailable':
          throw refusal(503, outcome.message)
      }
    }
    return {
      answer: {
        id: outcome.id,
        status: outcome.status,
        existing: outcome.existing,
      },
      created: !outcome.existing,
    }
  } catch (error) {
    throw refuseFailure(error, 'cloud design submit failed', { owner })
  }
}

/** Reads a design: anyone signed in may (see "Who may do what" in ./service.ts). */
export async function getDesign(
  env: ServerEnv,
  owner: string,
  id: string,
): Promise<CloudDesign> {
  try {
    const design = await readCloudDesign(env, id, owner)
    if (!design) throw refusal(404, designsCopy.http.notFound)
    return design
  } catch (error) {
    throw refuseFailure(error, 'cloud design read failed', { id })
  }
}

/** Deletes a design and its stored result: its owner only. */
export async function removeDesign(
  env: ServerEnv,
  owner: string,
  id: string,
): Promise<null> {
  try {
    const outcome = await deleteCloudDesign(env, id, owner)
    switch (outcome) {
      case 'deleted':
        return null
      case 'not_found':
        throw refusal(404, designsCopy.http.notFound)
      case 'forbidden':
        throw refusal(403, designsCopy.http.notOwner)
      case 'not_started':
        throw refusal(409, designsCopy.http.notStarted, { 'retry-after': '5' })
    }
  } catch (error) {
    throw refuseFailure(error, 'cloud design delete failed', { id })
  }
}

// ── The body cap ─────────────────────────────────────────────────────────

/**
 * A 413 for a server-function request whose body is over `MAX_BODY_BYTES`,
 * or null. Start parses the body before any function middleware runs, so
 * this is request middleware (src/start.ts). A declared length decides at
 * once; without one (a chunked upload), a copy is read up to the cap.
 */
export async function refuseOversizedBody(
  request: Request,
): Promise<Response | null> {
  const declared = request.headers.get('content-length')
  if (declared !== null) {
    return Number(declared) > MAX_BODY_BYTES
      ? refusal(413, designsCopy.http.bodyTooLarge)
      : null
  }
  if (!request.body) return null
  const reader = request.clone().body!.getReader()
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return null
      bytes += value.byteLength
      if (bytes > MAX_BODY_BYTES) {
        return refusal(413, designsCopy.http.bodyTooLarge)
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}
