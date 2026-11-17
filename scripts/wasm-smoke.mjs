// Check the WebAssembly build behaves like the native one.
//
// The Rust test suite covers the library; this covers the browser path: that
// the module loads with the imports the worker supplies, that the
// hand-written ABI round-trips strings correctly, that a design matches the
// fixture Python produced and carries a run record built from the host's
// clock and build facts, and that a bad request comes back as an error
// instead of a crash.
//
//   node scripts/wasm-smoke.mjs <module.wasm>

import { createHash } from 'node:crypto'
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

// Progress is collected per design: each run restarts near zero, so
// monotonicity only means anything within a single design.
let progress = []
const allProgress = []
const design = await loadOptimizer(wasmPath, (fraction, stage) =>
  progress.push({ fraction, stage }),
)
/** Run one design and return the ticks it produced. */
function designWithProgress(request) {
  progress = []
  const result = design(request)
  allProgress.push(progress)
  return { result, ticks: progress }
}
// What the worker passes in for the run record: the module's own digest
// (OPTIMIZER_WASM_DIGEST) and the deployment's commit.
const wasmDigest = createHash('sha256')
  .update(fs.readFileSync(wasmPath))
  .digest('hex')
const build = { wasm_sha256: wasmDigest, commit: 'smoke-test-commit' }

const cases = JSON.parse(
  fs.readFileSync(path.join(fixtures, 'real_genes.json'), 'utf8'),
)

for (const testCase of cases) {
  const expected = testCase.seeded_run
  const before = Date.now()
  const { result, ticks } = designWithProgress({
    CDS: testCase.sequence,
    name: testCase.id,
    options: testCase.seeded_options,
    build,
  })
  const after = Date.now()

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

  // The run record, built inside the module.
  const record = result.run_record
  check(`${testCase.id}: carries a run record`, record, '')
  if (!record) continue
  const cds = testCase.sequence.trim().toUpperCase().replaceAll('U', 'T')
  check(
    `${testCase.id}: record identifies the input`,
    record.input?.length === cds.length &&
      record.input?.sha256 === createHash('sha256').update(cds).digest('hex'),
    JSON.stringify(record.input),
  )
  check(
    `${testCase.id}: record has the seed the run used`,
    record.seed === result.seed && Number.isInteger(record.seed),
    `${record.seed} vs ${result.seed}`,
  )
  // Proves env.now_ms reached the module: without a clock, the start time
  // would be the Unix epoch.
  const startedAt = Date.parse(record.started_at)
  check(
    `${testCase.id}: record's start time is the host clock`,
    record.started_at.endsWith('Z') &&
      startedAt >= before - 1 &&
      startedAt <= after + 1 &&
      record.duration_seconds >= 0 &&
      record.duration_seconds <= (after - before) / 1000 + 0.01,
    `${record.started_at}, ${record.duration_seconds}s`,
  )
  check(
    `${testCase.id}: record names the Rust build`,
    record.versions?.runtime === 'rust' &&
      typeof record.versions.optimizer === 'string' &&
      record.versions.wasm_sha256 === wasmDigest &&
      record.versions.commit === build.commit,
    JSON.stringify(record.versions),
  )
  check(
    `${testCase.id}: record invents no Python versions`,
    !('dnachisel' in record.versions) &&
      !('python' in record.versions) &&
      !('algorithm_sha256' in record.versions),
    JSON.stringify(record.versions),
  )
  check(
    `${testCase.id}: record lists the options without the seed`,
    record.options &&
      !('seed' in record.options) &&
      Object.keys(testCase.seeded_options)
        .filter((key) => key !== 'seed')
        .every((key) => key in record.options),
    Object.keys(record.options ?? {}).join(','),
  )
}

// Without build facts the record still appears, leaving them out.
const bare = design({
  CDS: cases[0].sequence,
  name: cases[0].id,
  options: cases[0].seeded_options,
})
check(
  'a request without build facts still gets a run record',
  bare.run_record?.versions?.runtime === 'rust' &&
    !('wasm_sha256' in bare.run_record.versions) &&
    !('commit' in bare.run_record.versions),
  JSON.stringify(bare.run_record?.versions),
)

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
  if (result.error || !result.optimized_sequence || !result.run_record) {
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

const failed = checks.filter((entry) => !entry.ok)
for (const entry of checks) {
  console.log(
    `${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`,
  )
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
