// Load the optimizer's WebAssembly build and run it, the way a browser worker
// would. Used both to check the wasm actually works and to time it.
//
//   node scripts/wasm-harness.mjs <module.wasm> <cases.json>
//
// The module exposes a four-function ABI (see the wasm_abi module in
// src/lib.rs): alloc, dealloc, process, free_response. Strings cross as
// UTF-8 bytes in the module's own memory, and the response is length-prefixed.

import fs from 'node:fs'

/**
 * Instantiate the module and wrap every entry point it exports.
 *
 * `design`, `reverseTranslate` and `wggwReport` take a request object and
 * return the parsed JSON response; `codonTables` takes nothing. They all
 * share one framing convention (see the wasm_abi modules in the crate), so
 * one wrapper covers them.
 */
export async function loadModule(wasmPath, onProgress) {
  let memoryRef = null
  const imports = {
    env: {
      report_progress(fraction, stagePointer, stageLength) {
        if (!onProgress || !memoryRef) return
        const bytes = new Uint8Array(
          memoryRef.buffer,
          stagePointer,
          stageLength,
        )
        onProgress(fraction, new TextDecoder().decode(bytes))
      },
    },
  }
  const { instance } = await WebAssembly.instantiate(
    fs.readFileSync(wasmPath),
    imports,
  )
  const exports = instance.exports
  memoryRef = exports.memory

  /** Read and free a length-prefixed response. */
  function readResponse(responsePtr) {
    // The view is created after the call: growing the heap detaches old ones.
    const length = new DataView(exports.memory.buffer).getUint32(
      responsePtr,
      true,
    )
    const bytes = new Uint8Array(
      exports.memory.buffer,
      responsePtr + 4,
      length,
    ).slice()
    exports.free_response(responsePtr)
    return JSON.parse(new TextDecoder().decode(bytes))
  }

  /** Call a JSON-in/JSON-out export. */
  function call(name, request) {
    const payload = new TextEncoder().encode(JSON.stringify(request))
    const requestPtr = exports.alloc(payload.length)
    new Uint8Array(exports.memory.buffer, requestPtr, payload.length).set(
      payload,
    )
    try {
      return readResponse(exports[name](requestPtr, payload.length))
    } finally {
      exports.dealloc(requestPtr, payload.length)
    }
  }

  return {
    design: (request) => call('process', request),
    reverseTranslate: (request) => call('reverse_translate', request),
    wggwReport: (request) => call('wggw_report', request),
    codonTables: () => readResponse(exports.codon_tables()),
  }
}

/** Just the design entry point, for callers that want nothing else. */
export async function loadOptimizer(wasmPath, onProgress) {
  const { design } = await loadModule(wasmPath, onProgress)
  return design
}

const OPTIONS = {
  codon_optimize: 'human',
  codon_optimize_weight: 1.0,
  remove_cryptic_ss: true,
  remove_cryptic_ss_weight: 1.0,
  minimize_CpGs: true,
  minimize_CpGs_weight: 1.0,
  reduce_kmer_complexity: true,
  reduce_kmer_complexity_weight: 1.0,
  enforce_gc: true,
  stim_5: false,
  stim_3: false,
  split_point: null,
  selected_wggw_site: null,
  ensure_wggw: true,
  wggw_threshold: 0,
  seed: 1234,
}

async function main() {
  const [wasmPath, casesPath] = process.argv.slice(2)
  if (!wasmPath || !casesPath) {
    console.error('usage: wasm-harness.mjs <module.wasm> <cases.json>')
    process.exit(2)
  }
  const design = await loadOptimizer(wasmPath)
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'))

  for (const testCase of cases) {
    const name = testCase.name ?? testCase.id
    const started = performance.now()
    const result = design({ CDS: testCase.cds, name, options: OPTIONS })
    const seconds = (performance.now() - started) / 1000

    if (result.error) {
      console.error(`${name}: ${result.error}`)
      process.exitCode = 1
      continue
    }
    console.log(
      JSON.stringify({
        runtime: 'wasm',
        name,
        bp: testCase.cds.length,
        seconds: Math.round(seconds * 100) / 100,
        // Printed so the design can be compared with the other runtimes'.
        optimized_sha: hash(result.optimized_sequence),
        split_point: result.split_point,
      }),
    )
  }
}

/** Short stable digest, enough to tell two designs apart in a log. */
function hash(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
