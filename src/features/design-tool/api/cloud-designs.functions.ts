import { createServerFn } from '@tanstack/react-start'
import {
  getRequest,
  setResponseHeader,
  setResponseStatus,
} from '@tanstack/react-start/server'
import { env, waitUntil } from 'cloudflare:workers'

import type {
  CloudAnswer,
  CloudDesignSubmitted,
} from '@/features/design-tool/types/cloud-design'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import {
  deleteDesign,
  listMyDesigns,
  readDesign,
  statusOf,
  submitDesign,
} from '@/server/designs/handler'

/**
 * Cloud designs as server functions, called from the browser by
 * ./cloud-designs.ts. The handlers run only in the Worker: Start's compiler
 * replaces them with RPC stubs in the client bundle, so the `@/server` and
 * `cloudflare:workers` imports never reach the browser.
 *
 * Each handler is src/server/designs/handler.ts, which checks who is asking
 * before anything else and validates the input itself, so the validators
 * here only type it. Start's default same-origin check and the Worker's
 * passcode gate and body cap (src/server/worker-entry.ts) have already run.
 * Submitting, deleting and listing also need an account
 * (src/server/designs/identity.ts). `waitUntil` lets Better Auth finish a
 * session refresh after the response; like `env`, it is only named inside
 * handlers, so nothing from the Worker survives into the client bundle.
 */

/** Sends an answer: its HTTP status, never cached (a design is someone's unpublished sequence). */
function send<T>(answer: CloudAnswer<T>, created = false): CloudAnswer<T> {
  setResponseStatus(statusOf(answer, created))
  setResponseHeader('Cache-Control', 'no-store')
  if (!answer.ok && answer.retryAfter) {
    setResponseHeader('Retry-After', String(answer.retryAfter))
  }
  return answer
}

/** Submits a design to run in the cloud. Resubmitting returns the same id. */
export const submitCloudDesignFn = createServerFn({ method: 'POST' })
  .validator((input: { values: FormValues; seed?: number }) => input)
  .handler(async ({ data }) => {
    const answer = await submitDesign(getRequest(), env, data, { waitUntil })
    return send<CloudDesignSubmitted>(
      answer,
      answer.ok && !answer.data.existing,
    )
  })

/** Reads a cloud design: its status, and its inputs and result once known. */
export const readCloudDesignFn = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) =>
    send(await readDesign(getRequest(), env, data, { waitUntil })),
  )

/** Deletes a cloud design and its stored result. Its owner only. */
export const deleteCloudDesignFn = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) =>
    send(await deleteDesign(getRequest(), env, data, { waitUntil })),
  )

/** The signed-in account's cloud designs, for "My cloud designs". */
export const listMyCloudDesignsFn = createServerFn({ method: 'GET' }).handler(
  async () => send(await listMyDesigns(getRequest(), env, { waitUntil })),
)
