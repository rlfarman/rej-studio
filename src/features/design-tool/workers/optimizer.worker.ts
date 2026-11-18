/// <reference lib="webworker" />
//
// Runs the Rust optimizer off the main thread.
//
// A design takes seconds to minutes of solid computation, so running it on
// the main thread would freeze the tab. The worker loads the WebAssembly
// module once, then answers one design request at a time, posting progress
// as it goes. The ABI glue is shared with the Cloudflare Worker and the Node
// scripts (./optimizer-abi.ts); only fetching the module is browser-specific.

import {
  loadOptimizer,
  optimizerErrorCode,
  optimizerErrorOf,
  type OptimizerImports,
} from './optimizer-abi'
import {
  OPTIMIZER_WASM_DIGEST,
  OPTIMIZER_WASM_PATH,
} from './optimizer-asset.generated'
import type {
  OptimizerMessage,
  OptimizerRequest,
  OptimizerResponse,
  ReverseTranslateRequest,
} from './optimizer-protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope

function post(message: OptimizerResponse) {
  scope.postMessage(message)
}

/** Fetch and instantiate the module, streaming where the server allows. */
async function instantiateFromNetwork(imports: OptimizerImports) {
  // The digest makes each build a distinct URL: files under public/ carry no
  // content hash, so without it a browser could keep an older optimizer.
  const url = `${OPTIMIZER_WASM_PATH}?v=${OPTIMIZER_WASM_DIGEST}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`could not load the optimizer (HTTP ${response.status})`)
  }

  // Compiles while downloading where the server sets the right content type;
  // the fallback covers hosts that do not.
  try {
    return (await WebAssembly.instantiateStreaming(response, imports)).instance
  } catch {
    const bytes = await (await fetch(url)).arrayBuffer()
    // Compile, then instantiate the Module: the bytes overload of
    // `instantiate` resolves ambiguously against the Workers runtime types
    // (worker-configuration.d.ts), whose empty `Module` an ArrayBuffer
    // structurally matches.
    return WebAssembly.instantiate(await WebAssembly.compile(bytes), imports)
  }
}

/**
 * Started once and shared by every request: instantiation costs a fetch and
 * a compile, and the module holds no state between runs.
 */
const optimizerPromise = loadOptimizer(instantiateFromNetwork)

/** Report a module error, telling bad input apart from a real failure. */
function postError(runId: string, message: string) {
  post({ type: 'error', runId, code: optimizerErrorCode(message), message })
}

function postCrash(runId: string, error: unknown) {
  post({
    type: 'error',
    runId,
    code: 'unknown',
    message: error instanceof Error ? error.message : 'the optimizer failed',
  })
}

async function runDesign(request: OptimizerRequest) {
  try {
    const optimizer = await optimizerPromise
    const parsed = optimizer.design(
      { CDS: request.CDS, name: request.name, options: request.options },
      (fraction, stage) =>
        post({ type: 'progress', runId: request.runId, fraction, stage }),
    )

    const error = optimizerErrorOf(parsed)
    if (error !== null) {
      postError(request.runId, error)
      return
    }
    post({ type: 'result', runId: request.runId, result: parsed })
  } catch (error) {
    postCrash(request.runId, error)
  }
}

async function runReverseTranslation(request: ReverseTranslateRequest) {
  try {
    const optimizer = await optimizerPromise
    const parsed = optimizer.reverseTranslate({
      protein: request.protein,
      species: request.species,
    })

    const error = optimizerErrorOf(parsed)
    if (error !== null) {
      postError(request.runId, error)
      return
    }
    const cds =
      parsed && typeof parsed === 'object' && 'CDS' in parsed
        ? (parsed as { CDS: unknown }).CDS
        : null
    if (typeof cds !== 'string') {
      postError(request.runId, 'the optimizer returned no coding sequence')
      return
    }
    post({ type: 'reverse-translated', runId: request.runId, CDS: cds })
  } catch (error) {
    postCrash(request.runId, error)
  }
}

scope.addEventListener('message', (event: MessageEvent<OptimizerMessage>) => {
  const request = event.data
  // Reverse translation is cheap and the module runs one call at a time, so a
  // request that arrives mid-design simply waits its turn.
  if (request?.type === 'design') void runDesign(request)
  else if (request?.type === 'reverse-translate') {
    void runReverseTranslation(request)
  }
})
