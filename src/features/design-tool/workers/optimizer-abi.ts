// The optimizer module's hand-written ABI, wrapped once for every place that
// runs it: the browser's Web Worker, the Cloudflare Worker behind the MCP
// endpoint, and the Node scripts that smoke-test and time the committed
// `.wasm` (scripts/wasm-harness.mjs imports this file directly).
//
// Environment-neutral on purpose. How the module is obtained differs in each
// place (streamed over fetch in the browser, imported as a compiled module on
// workerd, which cannot compile WebAssembly from bytes at runtime, and read
// from disk in Node), so callers pass an `instantiate` function and this file
// owns only what they share: the progress import, the framing of strings in
// the module's memory, and how a failure is reported.
//
// Node runs this file with type stripping, so it must stay erasable
// TypeScript with no imports.
//
// The ABI itself is defined in rust/optimizer/src/lib.rs: strings cross as
// UTF-8 bytes in the module's own memory, every entry point takes a JSON
// request and returns a length-prefixed JSON response, and the module calls
// back into `env.report_progress` while a design runs.

interface OptimizerExports {
  memory: WebAssembly.Memory
  alloc: (length: number) => number
  dealloc: (pointer: number, length: number) => void
  process: (pointer: number, length: number) => number
  reverse_translate: (pointer: number, length: number) => number
  free_response: (pointer: number) => void
}

/** Progress inside a design: a fraction from 0 to 1 and the current stage. */
type OptimizerProgress = (fraction: number, stage: string) => void

/**
 * What the module imports. A type alias rather than an interface, so it is
 * assignable to `WebAssembly.Imports` (an interface has no implicit index
 * signature).
 */
export type OptimizerImports = {
  env: {
    report_progress: (
      fraction: number,
      stagePointer: number,
      stageLength: number,
    ) => void
  }
}

/** Produces a live instance of the module, given the imports it needs. */
export type InstantiateOptimizer = (
  imports: OptimizerImports,
) => Promise<WebAssembly.Instance>

/** A design request, as `process` takes it (`ProcessRequest` in contract.rs). */
interface OptimizerDesignRequest {
  CDS: string
  name: string
  options: unknown
}

/** A reverse-translation request (`ReverseTranslateRequest` in contract.rs). */
interface OptimizerReverseTranslateRequest {
  protein: string
  species: string
}

/** A live optimizer. Calls are synchronous and run one at a time. */
export interface LoadedOptimizer {
  /** The parsed JSON `process` returned: a result or `{ error }`. */
  design: (
    request: OptimizerDesignRequest,
    onProgress?: OptimizerProgress,
  ) => unknown
  /** The parsed JSON `reverse_translate` returned: `{ CDS }` or `{ error }`. */
  reverseTranslate: (request: OptimizerReverseTranslateRequest) => unknown
  /** What the module exports, so a caller can check nothing crept in. */
  exportNames: string[]
}

/** Instantiate the module and wrap its JSON-in/JSON-out entry points. */
export async function loadOptimizer(
  instantiate: InstantiateOptimizer,
): Promise<LoadedOptimizer> {
  // Set for the duration of one design. The module only calls back while a
  // call is on the stack, and calls never overlap.
  let progress: OptimizerProgress | null = null
  let live: OptimizerExports | null = null

  const instance = await instantiate({
    env: {
      report_progress(fraction, stagePointer, stageLength) {
        if (!progress || !live) return
        // The label lives in the module's memory and is only valid during
        // this call, so it is decoded now.
        const bytes = new Uint8Array(
          live.memory.buffer,
          stagePointer,
          stageLength,
        )
        progress(fraction, new TextDecoder().decode(bytes))
      },
    },
  })
  const exports = instance.exports as unknown as OptimizerExports
  live = exports

  function call(entry: 'process' | 'reverse_translate', request: unknown) {
    const payload = new TextEncoder().encode(JSON.stringify(request))

    const requestPointer = exports.alloc(payload.length)
    if (requestPointer === 0) throw new Error('the optimizer ran out of memory')
    new Uint8Array(exports.memory.buffer, requestPointer, payload.length).set(
      payload,
    )

    let responsePointer = 0
    try {
      responsePointer = exports[entry](requestPointer, payload.length)
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
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } finally {
      if (responsePointer !== 0) exports.free_response(responsePointer)
      exports.dealloc(requestPointer, payload.length)
    }
  }

  return {
    design(request, onProgress) {
      progress = onProgress ?? null
      try {
        return call('process', request)
      } finally {
        progress = null
      }
    },
    reverseTranslate: (request) => call('reverse_translate', request),
    exportNames: Object.keys(instance.exports).sort(),
  }
}

/** The `{ "error": "..." }` shape every entry point reports failures with. */
export function optimizerErrorOf(parsed: unknown): string | null {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'error' in parsed &&
    typeof (parsed as { error: unknown }).error === 'string'
  ) {
    return (parsed as { error: string }).error
  }
  return null
}

/**
 * Tells bad input apart from a real failure of the optimizer. The module's
 * messages for bad input name the sequence, codons, the WGGW site, an amino
 * acid or the species; anything else is a genuine failure.
 */
export function optimizerErrorCode(
  message: string,
): 'invalid_input' | 'backend' {
  return /sequence|codons|WGGW|multiple of 3|amino acid|species/i.test(message)
    ? 'invalid_input'
    : 'backend'
}
