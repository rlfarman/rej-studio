// Check the WebAssembly build behaves like the native one.
//
// The Rust test suite covers the library; this covers the browser path: that
// the module loads with no imports, that the hand-written ABI round-trips
// strings correctly, that a design matches the fixture Python produced, and
// that a bad request comes back as an error instead of a crash.
//
//   node scripts/wasm-smoke.mjs <module.wasm>

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOptimizer } from './wasm-harness.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(here, '..', 'rust', 'optimizer', 'tests', 'fixtures')

const checks = []
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail })
}

const wasmPath = process.argv[2]
if (!wasmPath) {
  console.error('usage: wasm-smoke.mjs <module.wasm>')
  process.exit(2)
}

const design = await loadOptimizer(wasmPath)
const cases = JSON.parse(fs.readFileSync(path.join(fixtures, 'real_genes.json'), 'utf8'))

for (const testCase of cases) {
  const expected = testCase.seeded_run
  const result = design({
    CDS: testCase.sequence,
    name: testCase.id,
    options: testCase.seeded_options,
  })

  check(`${testCase.id}: designs without error`, !result.error, result.error ?? '')
  check(
    `${testCase.id}: design matches Python`,
    result.optimized_sequence === expected.optimized_sequence,
  )
  check(`${testCase.id}: 5' fragment matches`, result.seq5 === expected.seq5)
  check(`${testCase.id}: 3' fragment matches`, result.seq3 === expected.seq3)
  check(`${testCase.id}: split point matches`, result.split_point === expected.split_point)
}

// A malformed request must be reported, not crash the module.
const bad = design({ CDS: 'ATGXX', name: 'bad', options: {} })
check('a bad sequence returns an error', typeof bad.error === 'string', JSON.stringify(bad))

// The module must still work afterwards, proving the error path left no mess.
const afterError = design({
  CDS: cases[0].sequence,
  name: cases[0].id,
  options: cases[0].seeded_options,
})
check(
  'the module still works after an error',
  afterError.optimized_sequence === cases[0].seeded_run.optimized_sequence,
)

// Many small designs in a row, to catch a leak or a stale memory view.
let repeated = true
for (let i = 0; i < 50; i += 1) {
  const result = design({
    CDS: 'ATGCGTAAGCTGGACTCCGAAGACGATCTGGAATGA',
    name: `repeat-${i}`,
    options: { codon_optimize: 'human', enforce_gc: true, seed: i },
  })
  if (result.error || !result.optimized_sequence) {
    repeated = false
    break
  }
}
check('50 designs in a row all succeed', repeated)

const failed = checks.filter((entry) => !entry.ok)
for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`)
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
