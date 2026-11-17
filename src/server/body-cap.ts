import { designsCopy } from './designs/copy'

/**
 * The body cap for server-function calls, applied by the Worker before Start
 * reads the body (Start parses it before any server-function code runs).
 *
 * A cloud design is ~45 KB of JSON at most (the DNA, and the protein it came
 * from, in Start's serialization); anything much bigger is not one.
 *
 * - A declared `Content-Length` over the cap is refused at once, 413, in the
 *   `CloudAnswer` shape the caller reads. Browsers declare it for every
 *   fetch() body the app sends, so this is the path that matters.
 * - A chunked body (no length) is passed on through a stream that errors
 *   once it passes the cap, so no more than the cap is ever read; Start then
 *   fails the call (500). Buffering it here first to answer 413 would read
 *   the whole thing into memory, which is what the cap is for.
 */

export const MAX_SERVER_FN_BODY_BYTES = 256 * 1024

export function capServerFnBody(request: Request): Request | Response {
  const declared = request.headers.get('content-length')
  if (declared !== null) {
    if (Number(declared) <= MAX_SERVER_FN_BODY_BYTES) return request
    return Response.json(
      {
        ok: false,
        reason: 'too_large',
        message: designsCopy.http.bodyTooLarge,
      },
      { status: 413, headers: { 'cache-control': 'no-store' } },
    )
  }
  if (!request.body) return request
  let bytes = 0
  const capped = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength
        if (bytes > MAX_SERVER_FN_BODY_BYTES) {
          controller.error(new RangeError(designsCopy.http.bodyTooLarge))
        } else {
          controller.enqueue(chunk)
        }
      },
    }),
  )
  return new Request(request, {
    body: capped,
    duplex: 'half',
  } as RequestInit)
}
