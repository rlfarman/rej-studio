import {
  CLOUD_REFUSAL_STATUS,
  type CloudAnswer,
  type CloudDesign,
  type CloudDesignSubmitted,
} from '@/features/design-tool/types/cloud-design'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { designToolCopy } from '@/features/design-tool/copy'

import {
  deleteCloudDesignFn,
  readCloudDesignFn,
  submitCloudDesignFn,
} from './cloud-designs.functions'

/**
 * The design tool's client for cloud designs: the one place a page talks to
 * the Worker, through the server functions in ./cloud-designs.functions.ts.
 * Everything else the design tool does stays in the browser.
 *
 * Expected failures come back as values, with the server's own message (it
 * is written for the person reading it), so callers never need a try/catch.
 * `status` is the refusal's HTTP status, or 0 when no answer arrived
 * (offline). An expired sign-in is the passcode gate's 401, whose message
 * says to sign in again.
 */

const copy = designToolCopy.cloud

export type CloudCall<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

async function call<T>(
  run: () => Promise<CloudAnswer<T>>,
): Promise<CloudCall<T>> {
  let answer: CloudAnswer<T>
  try {
    answer = await run()
  } catch {
    // No answer at all (offline), or one Start's client could not read as
    // JSON (something other than the Worker answered): it throws for both.
    return { ok: false, status: 0, message: copy.unreachable }
  }
  if (answer.ok) return answer
  return {
    ok: false,
    status: CLOUD_REFUSAL_STATUS[answer.reason] ?? 500,
    message: answer.message ?? copy.failedGeneric,
  }
}

/** Submits a design to run in the cloud. Resubmitting returns the same id. */
export function submitCloudDesign(
  values: FormValues,
): Promise<CloudCall<CloudDesignSubmitted>> {
  return call(() => submitCloudDesignFn({ data: { values } }))
}

/** Reads a cloud design: its status, and its inputs and result once known. */
export function fetchCloudDesign(id: string): Promise<CloudCall<CloudDesign>> {
  return call(() => readCloudDesignFn({ data: { id } }))
}

/** Deletes a cloud design and its stored result. Its owner only. */
export function deleteCloudDesign(id: string): Promise<CloudCall<null>> {
  return call(() => deleteCloudDesignFn({ data: { id } }))
}
