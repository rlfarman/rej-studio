// Load the optimizer's WebAssembly build and run it, the way a browser worker
// would. Used both to check the wasm actually works and to time it.
//
//   node scripts/wasm-harness.mjs <module.wasm> <cases.json>
//
// The ABI glue is the app's own (src/features/design-tool/workers/
// optimizer-abi.ts, run through Node's type stripping), so the smoke test
// exercises the same wrapper the browser and the Cloudflare Worker use rather
// than a copy of it.

import fs from 'node:fs'
import { loadOptimizer } from '../src/features/design-tool/workers/optimizer-abi.ts'

/**
 * Instantiate the module from disk and wrap both of its entry points.
 *
 * `onProgress`, when given, hears every design's progress ticks.
 */
export async function loadModule(wasmPath, onProgress) {
  const optimizer = await loadOptimizer(
    async (imports) =>
      (await WebAssembly.instantiate(fs.readFileSync(wasmPath), imports))
        .instance,
  )
  return {
    design: (request) => optimizer.design(request, onProgress),
    reverseTranslate: optimizer.reverseTranslate,
    exportNames: optimizer.exportNames,
  }
}

/** Just the design entry point, for callers that want nothing else. */
async function loadDesign(wasmPath) {
  const { design } = await loadModule(wasmPath)
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
  const design = await loadDesign(wasmPath)
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
