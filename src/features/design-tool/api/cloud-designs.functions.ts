import { createMiddleware, createServerFn } from '@tanstack/react-start'
import {
  getRequest,
  setResponseHeader,
  setResponseStatus,
} from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

import {
  authorize,
  createDesign,
  getDesign,
  parseDesignId,
  parseSubmission,
  removeDesign,
} from '@/server/designs/handler'

import { cloudDesignFetch } from './cloud-design-fetch'

/**
 * Cloud designs as server functions: submit, read and delete, called from
 * the browser by ./cloud-designs.ts. The handlers, validators and the
 * middleware's server half run only in the Worker; Start's compiler replaces
 * them with RPC stubs in the client bundle, so the `@/server` and
 * `cloudflare:workers` imports never reach the browser.
 *
 * Every call, in order:
 *
 * 1. The passcode gate (src/server/auth/gate.ts) and, in src/start.ts,
 *    Start's same-origin (CSRF) check and the body cap, before Start reads
 *    the body.
 * 2. `cloudDesignCaller`: `no-store`, and who is asking, fail-closed (401 or
 *    503) — before the input is even looked at.
 * 3. The validator: the form's own schema, or a well-formed id.
 * 4. The handler, which sets the success status (202 for a new run).
 *
 * A refusal is thrown as a `Response` with its status and headers
 * (src/server/designs/handler.ts). On the client, `cloudDesignFetch`
 * (./cloud-design-fetch.ts) turns any answer that is not a successful
 * server-function result into a thrown `CloudDesignRefusal`, so a call
 * either returns the typed value or throws.
 */

const cloudDesignCaller = createMiddleware({ type: 'function' })
  .client(({ next }) => next({ fetch: cloudDesignFetch }))
  .server(async ({ next }) => {
    // A design is someone's unpublished sequence: no cache between here and
    // the browser may keep a copy.
    setResponseHeader('cache-control', 'no-store')
    const owner = await authorize(getRequest(), env)
    return next({ context: { owner } })
  })

/** Submits a design to run in the cloud. Resubmitting returns the same id. */
export const submitCloudDesignFn = createServerFn({ method: 'POST' })
  .middleware([cloudDesignCaller])
  .validator(parseSubmission)
  .handler(async ({ data, context }) => {
    const { answer, created } = await createDesign(env, context.owner, data)
    setResponseStatus(created ? 202 : 200)
    return answer
  })

/** Reads a cloud design: its status, and its inputs and result once known. */
export const readCloudDesignFn = createServerFn({ method: 'GET' })
  .middleware([cloudDesignCaller])
  .validator(parseDesignId)
  .handler(({ data, context }) => getDesign(env, context.owner, data.id))

/** Deletes a cloud design and its stored result. Its owner only. */
export const deleteCloudDesignFn = createServerFn({ method: 'POST' })
  .middleware([cloudDesignCaller])
  .validator(parseDesignId)
  .handler(({ data, context }) => removeDesign(env, context.owner, data.id))
