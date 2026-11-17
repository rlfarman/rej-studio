import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { designToolCopy } from '@/features/design-tool/copy'

import { CloudDesignRefusal, cloudDesignFetch } from './cloud-design-fetch'
import {
  deleteCloudDesign,
  fetchCloudDesign,
  submitCloudDesign,
} from './cloud-designs'
import {
  deleteCloudDesignFn,
  readCloudDesignFn,
  submitCloudDesignFn,
} from './cloud-designs.functions'
import { formValues } from '@/server/designs/test-utils'

// The browser side of the cloud-design server functions: what the custom
// fetch lets through, and how the client turns every outcome into a value.
// The server functions themselves are mocked (src/test/setup.ts); their
// server side is src/server/designs/handler.test.ts, and the whole round
// trip is e2e/cloud-design.spec.ts and scripts/smoke-worker.mjs.

const copy = designToolCopy.cloud
const ID = 'a'.repeat(64)

afterEach(() => {
  vi.unstubAllGlobals()
})

function answer(body: BodyInit | null, init: ResponseInit) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, init)),
  )
}

async function refusalFrom(): Promise<CloudDesignRefusal> {
  const error = await cloudDesignFetch('/api/fn/x', {}).then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).toBeInstanceOf(CloudDesignRefusal)
  return error as CloudDesignRefusal
}

describe('cloudDesignFetch', () => {
  it('passes a serialized server-function answer on, with the cookie', async () => {
    answer('{}', {
      status: 202,
      headers: {
        'content-type': 'application/json',
        'x-tss-serialized': 'true',
      },
    })
    const response = await cloudDesignFetch('/api/fn/x', { method: 'POST' })
    expect(response.status).toBe(202)
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
    })
  })

  it('refuses the gate’s 401, which is JSON but not a result', async () => {
    answer(JSON.stringify({ error: 'Sign in again.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
    const refusal = await refusalFrom()
    expect(refusal).toMatchObject({
      status: 401,
      serverMessage: 'Sign in again.',
      json: true,
    })
  })

  it('refuses a thrown refusal from a server function', async () => {
    answer(JSON.stringify({ error: 'Busy.' }), {
      status: 503,
      headers: {
        'content-type': 'application/json',
        'x-tss-raw-response': 'thrown',
        'retry-after': '2',
      },
    })
    expect(await refusalFrom()).toMatchObject({
      status: 503,
      serverMessage: 'Busy.',
    })
  })

  it('refuses a page that is not JSON, or JSON that is not a refusal', async () => {
    answer('<html>', { status: 502, headers: { 'content-type': 'text/html' } })
    expect(await refusalFrom()).toMatchObject({ status: 502, json: false })
    answer('{"nope":1}', {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
    expect(await refusalFrom()).toMatchObject({
      status: 500,
      serverMessage: null,
      json: true,
    })
  })

  it('refuses a 200 that is not a server-function answer', async () => {
    answer('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
    expect(await refusalFrom()).toMatchObject({ status: 200, json: false })
  })
})

describe('the cloud-design client', () => {
  it('returns the server function’s value', async () => {
    const submitted = { id: ID, status: 'queued' as const, existing: false }
    vi.mocked(submitCloudDesignFn).mockResolvedValueOnce(submitted)
    const values = formValues()
    expect(await submitCloudDesign(values)).toEqual({
      ok: true,
      data: submitted,
    })
    expect(submitCloudDesignFn).toHaveBeenCalledWith({ data: { values } })
  })

  it('reads and deletes by id', async () => {
    vi.mocked(readCloudDesignFn).mockResolvedValueOnce({
      id: ID,
      status: 'queued',
    })
    vi.mocked(deleteCloudDesignFn).mockResolvedValueOnce(null)
    expect(await fetchCloudDesign(ID)).toMatchObject({ ok: true })
    expect(await deleteCloudDesign(ID)).toEqual({ ok: true, data: null })
    expect(readCloudDesignFn).toHaveBeenCalledWith({ data: { id: ID } })
    expect(deleteCloudDesignFn).toHaveBeenCalledWith({ data: { id: ID } })
  })

  it('turns a refusal into its status and the Worker’s message', async () => {
    vi.mocked(readCloudDesignFn).mockRejectedValueOnce(
      new CloudDesignRefusal(404, 'No such design.', true),
    )
    expect(await fetchCloudDesign(ID)).toEqual({
      ok: false,
      status: 404,
      message: 'No such design.',
    })
  })

  it('falls back to its own copy when the Worker sent no message', async () => {
    vi.mocked(readCloudDesignFn).mockRejectedValueOnce(
      new CloudDesignRefusal(500, null, true),
    )
    expect(await fetchCloudDesign(ID)).toMatchObject({
      status: 500,
      message: copy.failedGeneric,
    })
    vi.mocked(readCloudDesignFn).mockRejectedValueOnce(
      new CloudDesignRefusal(502, null, false),
    )
    expect(await fetchCloudDesign(ID)).toMatchObject({
      status: 502,
      message: copy.unreachable,
    })
  })

  it('answers status 0 when nothing answered at all', async () => {
    // The default mock: fetch failed, as offline.
    expect(await fetchCloudDesign(ID)).toEqual({
      ok: false,
      status: 0,
      message: copy.unreachable,
    })
  })
})
