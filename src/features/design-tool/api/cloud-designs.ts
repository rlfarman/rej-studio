import type {
  CloudDesign,
  CloudDesignSubmitted,
} from '@/features/design-tool/types/cloud-design'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { designToolCopy } from '@/features/design-tool/copy'

import { CloudDesignRefusal } from './cloud-design-fetch'
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
 * Expected failures come back as values, with the server's own message when
 * it sent one (it is written for the person reading it), so callers never
 * need a try/catch. `status` is the HTTP status, or 0 when no answer arrived
 * (offline). An expired sign-in is a 401 from the passcode gate, whose
 * message says to sign in again.
 */

const copy = designToolCopy.cloud

export type CloudCall<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

async function call<T>(run: () => Promise<T>): Promise<CloudCall<T>> {
  try {
    return { ok: true, data: await run() }
  } catch (error) {
    if (error instanceof CloudDesignRefusal) {
      return {
        ok: false,
        status: error.status,
        // Not JSON means something else answered instead of the Worker.
        message:
          error.serverMessage ??
          (error.json ? copy.failedGeneric : copy.unreachable),
      }
    }
    // fetch itself failed: offline, or the connection dropped.
    if (error instanceof TypeError) {
      return { ok: false, status: 0, message: copy.unreachable }
    }
    return { ok: false, status: 0, message: copy.failedGeneric }
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
