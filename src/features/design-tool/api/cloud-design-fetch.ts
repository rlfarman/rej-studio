import { X_TSS_SERIALIZED, type CustomFetch } from '@tanstack/react-start'

import { cloudDesignRefusalSchema } from '@/features/design-tool/types/cloud-design'

/**
 * The browser half of the cloud-design server functions' transport
 * (./cloud-designs.functions.ts), on its own so it can be tested without
 * Start's compiler.
 */

/**
 * A refusal: its HTTP status and, when the Worker sent one, its message
 * (written for the person reading it). `json` is false when the body was
 * not JSON at all, i.e. something other than the Worker answered.
 */
export class CloudDesignRefusal extends Error {
  constructor(
    readonly status: number,
    readonly serverMessage: string | null,
    readonly json: boolean,
  ) {
    super(serverMessage ?? `HTTP ${status}`)
    this.name = 'CloudDesignRefusal'
  }
}

/**
 * fetch for these calls. Start's client turns a serialized result into the
 * value, but returns any other JSON body as if it were the result (the
 * gate's `{ error }` 401 would read as a design), so this lets only a
 * successful, serialized answer through.
 */
export const cloudDesignFetch: CustomFetch = async (url, init) => {
  const response = await fetch(url, { ...init, credentials: 'same-origin' })
  if (response.ok && response.headers.has(X_TSS_SERIALIZED)) return response
  let body: unknown
  try {
    body = await response.json()
  } catch {
    // Not JSON: something between here and the Worker answered.
    throw new CloudDesignRefusal(response.status, null, false)
  }
  const refusal = cloudDesignRefusalSchema.safeParse(body)
  throw new CloudDesignRefusal(
    response.status,
    refusal.success ? refusal.data.error : null,
    true,
  )
}
