/// <reference lib="webworker" />
//
// Runs the Rust optimizer off the main thread.
//
// A design takes seconds to minutes of solid computation, so running it on
// the main thread would freeze the tab. The worker loads the WebAssembly
// module once, then answers one design request at a time, posting progress
// as it goes.
//
// The module exports a small hand-written ABI (see rust/optimizer/src/lib.rs):
// strings cross as UTF-8 bytes in its own memory, and it calls back into
// `env.report_progress` while it works.

import {
  OPTIMIZER_WASM_DIGEST,
  OPTIMIZER_WASM_PATH,
} from './optimizer-asset.generated'
import type { OptimizerRequest, OptimizerResponse } from './optimizer-protocol'

interface OptimizerExports {
  memory: WebAssembly.Memory
  alloc: (length: number) => number
  dealloc: (pointer: number, length: number) => void
  process: (pointer: number, length: number) => number
  free_response: (pointer: number) => void
}

const scope = self as unknown as DedicatedWorkerGlobalScope

/** The run currently executing, so progress can be attributed to it. */
let activeRunId: string | null = null

/** Set once the module is live, so the progress import can reach its memory. */
let instantiated: OptimizerExports | null = null

function post(message: OptimizerResponse) {
  scope.postMessage(message)
}

/**
 * Instantiate the module, supplying the progress callback it imports.
 *
 * Started once and shared by every request: instantiation costs a fetch and
 * a compile, and the module holds no state between runs.
 */
const modulePromise: Promise<OptimizerExports> = (async () => {
  const imports = {
    env: {
      // Called from inside the design. The label lives in the module's
      // memory and is only valid during this call, so it is decoded now.
      report_progress(
        fraction: number,
        stagePointer: number,
        stageLength: number,
      ) {
        if (!activeRunId) return
        const exports = instantiated
        if (!exports) return
        const bytes = new Uint8Array(
          exports.memory.buffer,
          stagePointer,
          stageLength,
        )
        post({
          type: 'progress',
          runId: activeRunId,
          fraction,
          stage: new TextDecoder().decode(bytes),
        })
      },
    },
  }

  // The digest makes each build a distinct URL: files under public/ carry no
  // content hash, so without it a browser could keep an older optimizer.
  const url = `${OPTIMIZER_WASM_PATH}?v=${OPTIMIZER_WASM_DIGEST}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`could not load the optimizer (HTTP ${response.status})`)
  }

  // Compiles while downloading where the server sets the right content type;
  // the fallback covers hosts that do not.
  let instance: WebAssembly.Instance
  try {
    ;({ instance } = await WebAssembly.instantiateStreaming(response, imports))
  } catch {
    const bytes = await (await fetch(url)).arrayBuffer()
    ;({ instance } = await WebAssembly.instantiate(bytes, imports))
  }

  instantiated = instance.exports as unknown as OptimizerExports
  return instantiated
})()

/** Run one design, returning the raw JSON the module produced. */
function design(exports: OptimizerExports, request: OptimizerRequest): string {
  const payload = new TextEncoder().encode(
    JSON.stringify({
      CDS: request.CDS,
      name: request.name,
      options: request.options,
    }),
  )

  const requestPointer = exports.alloc(payload.length)
  if (requestPointer === 0) throw new Error('the optimizer ran out of memory')
  new Uint8Array(exports.memory.buffer, requestPointer, payload.length).set(
    payload,
  )

  let responsePointer = 0
  try {
    responsePointer = exports.process(requestPointer, payload.length)
    // Read the length and bytes only after the call: growing the heap
    // detaches any view created earlier.
    const length = new DataView(exports.memory.buffer).getUint32(
      responsePointer,
      true,
    )
    const bytes = new Uint8Array(
      exports.memory.buffer,
      responsePointer + 4,
      length,
    ).slice()
    return new TextDecoder().decode(bytes)
  } finally {
    if (responsePointer !== 0) exports.free_response(responsePointer)
    exports.dealloc(requestPointer, payload.length)
  }
}

scope.addEventListener('message', (event: MessageEvent<OptimizerRequest>) => {
  const request = event.data
  if (request?.type !== 'design') return

  void (async () => {
    activeRunId = request.runId
    try {
      const exports = await modulePromise
      const raw = design(exports, request)
      const parsed: unknown = JSON.parse(raw)

      if (
        parsed &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof (parsed as { error: unknown }).error === 'string'
      ) {
        const message = (parsed as { error: string }).error
        post({
          type: 'error',
          runId: request.runId,
          // The module reports bad input in the same words the server does;
          // anything else is a genuine failure of the optimizer.
          code: /sequence|codons|WGGW|multiple of 3/i.test(message)
            ? 'invalid_input'
            : 'backend',
          message,
        })
        return
      }

      post({ type: 'result', runId: request.runId, result: parsed })
    } catch (error) {
      post({
        type: 'error',
        runId: request.runId,
        code: 'unknown',
        message:
          error instanceof Error ? error.message : 'the optimizer failed',
      })
    } finally {
      activeRunId = null
    }
  })()
})
