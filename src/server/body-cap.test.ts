// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test'

import { capServerFnBody, MAX_SERVER_FN_BODY_BYTES } from './body-cap'

const URL_ = 'http://localhost/_serverFn/x'

function declared(bytes: number) {
  return new Request(URL_, {
    method: 'POST',
    headers: { 'content-length': String(bytes) },
    body: new Uint8Array(bytes),
  })
}

function chunked(bytes: number) {
  return new Request(URL_, {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(bytes))
        controller.close()
      },
    }),
    duplex: 'half',
  } as RequestInit)
}

describe('capServerFnBody', () => {
  it('refuses a declared length over the cap with a 413 refusal', async () => {
    const answer = capServerFnBody(declared(MAX_SERVER_FN_BODY_BYTES + 1))
    expect(answer).toBeInstanceOf(Response)
    expect((answer as Response).status).toBe(413)
    expect(await (answer as Response).json()).toMatchObject({
      ok: false,
      reason: 'too_large',
    })
  })

  it('passes a declared length within the cap through untouched', () => {
    const request = declared(MAX_SERVER_FN_BODY_BYTES)
    expect(capServerFnBody(request)).toBe(request)
  })

  it('passes a chunked body within the cap through whole', async () => {
    const out = capServerFnBody(chunked(1000)) as Request
    expect((await out.arrayBuffer()).byteLength).toBe(1000)
  })

  it('cuts a chunked body off past the cap', async () => {
    const out = capServerFnBody(
      chunked(MAX_SERVER_FN_BODY_BYTES + 1),
    ) as Request
    await expect(out.arrayBuffer()).rejects.toThrow()
  })

  it('leaves a request with no body alone', () => {
    const request = new Request(URL_)
    expect(capServerFnBody(request)).toBe(request)
  })
})
