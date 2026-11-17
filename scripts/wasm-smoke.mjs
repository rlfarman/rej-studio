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
import { loadModule } from './wasm-harness.mjs'

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

// Progress is collected per design: each run restarts near zero, so
// monotonicity only means anything within a single design.
let progress = []
const allProgress = []
const { design, reverseTranslate, wggwReport, codonTables } = await loadModule(
  wasmPath,
  (fraction, stage) => progress.push({ fraction, stage }),
)
/** Run one design and return the ticks it produced. */
function designWithProgress(request) {
  progress = []
  const result = design(request)
  allProgress.push(progress)
  return { result, ticks: progress }
}
const cases = JSON.parse(
  fs.readFileSync(path.join(fixtures, 'real_genes.json'), 'utf8'),
)

for (const testCase of cases) {
  const expected = testCase.seeded_run
  const { result, ticks } = designWithProgress({
    CDS: testCase.sequence,
    name: testCase.id,
    options: testCase.seeded_options,
  })

  check(
    `${testCase.id}: designs without error`,
    !result.error,
    result.error ?? '',
  )
  check(
    `${testCase.id}: progress only moves forward`,
    ticks.length > 0 &&
      ticks.every(
        (tick, i) => i === 0 || tick.fraction >= ticks[i - 1].fraction,
      ),
    `${ticks.length} ticks`,
  )
  check(
    `${testCase.id}: design matches Python`,
    result.optimized_sequence === expected.optimized_sequence,
  )
  check(`${testCase.id}: 5' fragment matches`, result.seq5 === expected.seq5)
  check(`${testCase.id}: 3' fragment matches`, result.seq3 === expected.seq3)
  check(
    `${testCase.id}: split point matches`,
    result.split_point === expected.split_point,
  )
}

// A malformed request must be reported, not crash the module.
const bad = design({ CDS: 'ATGXX', name: 'bad', options: {} })
check(
  'a bad sequence returns an error',
  typeof bad.error === 'string',
  JSON.stringify(bad),
)

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

// Stage captions are shown to the user, so they must read like the Python
// backend's wording rather than a raw objective label.
const everyTick = allProgress.flat()
check('progress is reported', everyTick.length > 0, `${everyTick.length} ticks`)
check(
  'progress stages are human-readable',
  everyTick.some((tick) =>
    /^Optimizing sequence \(\d+\/\d+\)$/.test(tick.stage),
  ) && !everyTick.some((tick) => tick.stage.includes('[')),
  everyTick.find((tick) => tick.stage.includes('['))?.stage ?? '',
)

// --- The other exports -----------------------------------------------------
//
// Reverse translation and the codon tables are the only implementations left,
// so the browser path has to exercise them too.

const translated = reverseTranslate({ protein: 'MKR*', species: 'mouse' })
check(
  'reverse translation returns DNA',
  translated.CDS === 'ATGAAGAGATGA',
  JSON.stringify(translated),
)
check(
  'reverse translation refuses an unknown species',
  typeof reverseTranslate({ protein: 'MK*', species: 'rat' }).error ===
    'string',
)
check(
  'reverse translation refuses a non-protein',
  typeof reverseTranslate({ protein: 'MZ*', species: 'human' }).error ===
    'string',
)
// The design must be runnable from what reverse translation produced.
const fromProtein = design({
  CDS: translated.CDS,
  name: 'from-protein',
  options: { codon_optimize: 'mouse', enforce_gc: true, seed: 7 },
})
check(
  'a reverse-translated sequence designs',
  !fromProtein.error && fromProtein.optimized_sequence.length > 0,
  fromProtein.error ?? '',
)

const tables = codonTables()
check(
  'the codon tables cover both species',
  Object.keys(tables).join(',') === 'human,mouse' &&
    Object.keys(tables.human).length === 64 &&
    Object.keys(tables.mouse).length === 64,
  Object.keys(tables).join(','),
)
check(
  // Mouse uses AGA and AGG equally, so both are the most-preferred codon and
  // the backtranslation order picks AGA — which is what `translated` above
  // shows, and where the TypeScript table this replaced said AGG.
  'the codon tables top out at 1 for the most-used codon',
  tables.mouse.AGA === 1 &&
    tables.mouse.AGG === 1 &&
    tables.mouse.CGT < 0.5 &&
    tables.human.CTG === 1,
  `mouse AGA ${tables.mouse.AGA}, AGG ${tables.mouse.AGG}`,
)

const report = wggwReport({ sequence: cases[0].sequence, split_point: 600 })
check(
  'the WGGW report lists candidates in distance order',
  Array.isArray(report.candidates) &&
    report.candidates.length > 0 &&
    report.by_distance.length === report.candidates.length &&
    report.by_distance.every(
      (position, index) =>
        index === 0 ||
        Math.abs(report.by_distance[index - 1] - 600) <=
          Math.abs(position - 600),
    ),
  JSON.stringify(report.candidates?.slice(0, 3) ?? report),
)
check(
  'the WGGW report names the split it would choose',
  typeof report.split?.split_point === 'number',
  JSON.stringify(report.split),
)
check(
  'a bad WGGW request is an error, not a crash',
  typeof wggwReport({ nope: true }).error === 'string',
)

const failed = checks.filter((entry) => !entry.ok)
for (const entry of checks) {
  console.log(
    `${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`,
  )
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
