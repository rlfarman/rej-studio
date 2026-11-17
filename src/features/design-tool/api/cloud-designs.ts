import {
  cloudDesignRefusalSchema,
  cloudDesignSchema,
  cloudDesignSubmittedSchema,
  type CloudDesign,
  type CloudDesignSubmitted,
} from '@/features/design-tool/types/cloud-design'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { designToolCopy } from '@/features/design-tool/copy'

/**
 * The design tool's client for `/api/designs`: the one place a page talks to
 * the Worker. Everything else the design tool does stays in the browser.
 *
 * Expected failures come back as values, with the server's own message when
 * it sent one (it is written for the person reading it), so callers never
 * need a try/catch. `status` is 0 when no answer arrived — offline, or an
 * expired Cloudflare Access session, whose sign-in redirect a fetch cannot
 * follow.
 */

const copy = designToolCopy.cloud

export type CloudCall<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

const BASE = '/api/designs'

interface CallInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
}

async function call<T>(
  input: string,
  init: CallInit,
  parse: (body: unknown) => T,
): Promise<CloudCall<T>> {
  let response: Response
  try {
    response = await fetch(input, {
      ...init,
      // Same origin only: the Access cookie must go with it, and nothing
      // else should.
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...init.headers },
    })
  } catch {
    return { ok: false, status: 0, message: copy.unreachable }
  }

  if (response.status === 204) return { ok: true, data: parse(null) }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // An HTML page where JSON was expected is Access's sign-in page.
    return { ok: false, status: response.status, message: copy.unreachable }
  }

  if (!response.ok) {
    const refusal = cloudDesignRefusalSchema.safeParse(body)
    return {
      ok: false,
      status: response.status,
      message: refusal.success ? refusal.data.error : copy.failedGeneric,
    }
  }
  try {
    return { ok: true, data: parse(body) }
  } catch {
    return { ok: false, status: response.status, message: copy.failedGeneric }
  }
}

/** Submits a design to run in the cloud. Resubmitting returns the same id. */
export function submitCloudDesign(
  values: FormValues,
): Promise<CloudCall<CloudDesignSubmitted>> {
  return call(
    BASE,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values }),
    },
    (body) => cloudDesignSubmittedSchema.parse(body),
  )
}

/** Reads a cloud design: its status, and its inputs and result once known. */
export function fetchCloudDesign(id: string): Promise<CloudCall<CloudDesign>> {
  return call(
    `${BASE}/${encodeURIComponent(id)}`,
    { method: 'GET', cache: 'no-store' },
    (body) => cloudDesignSchema.parse(body),
  )
}

/** Deletes a cloud design and its stored result. Its owner only. */
export function deleteCloudDesign(id: string): Promise<CloudCall<null>> {
  return call(
    `${BASE}/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    () => null,
  )
}
