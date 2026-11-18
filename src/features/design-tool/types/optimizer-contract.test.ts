/**
 * Contract tests against the optimizer's real output.
 *
 * `process-result.fixture.json` is what the committed
 * `public/optimizer/rej-optimizer.wasm` returns for a small seeded run with
 * every objective on (processing time zeroed). It matched the retired
 * Python backend's contract fixture field for field. If the Rust result
 * shape moves, this fails here instead of showing up as `undefined` in the
 * results panel.
 */
import { describe, expect, it } from 'vite-plus/test'
import { jobErrorSchema, processResultSchema } from './optimizer-contract'
import realResult from './process-result.fixture.json'

// What the Python backend attached to the same run. Designs saved in a
// browser's history before the browser optimizer took over carry these.
const PYTHON_RUN_RECORD = {
  corpus_version: null,
  duration_seconds: 0.031,
  input: {
    length: 81,
    sha256: 'fd125526f98402a082c213093db38a54720b4bc020106cdc2d094bfcefca63bb',
  },
  options: { codon_optimize: 'human', split_point: 45, wggw_threshold: 300 },
  record_version: 1,
  seed: 20261116,
  started_at: '2026-11-16T16:52:31.569180Z',
  versions: {
    algorithm_sha256: '85b3640072d3',
    commit: null,
    dnachisel: '3.2.16',
    python: '3.14.10',
  },
}

describe('processResultSchema', () => {
  it('parses a real optimizer result', () => {
    const parsed = processResultSchema.safeParse(realResult)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.seed).toBe(20261116)
    expect(parsed.data.used_wggw_as_split).toBe(true)
    expect(parsed.data.wggw_info?.main.motif).toBe('TGGA')
    expect(parsed.data.wggw_info?.main.original_codons).toEqual(['CTG', 'GAG'])
    expect(parsed.data.objectives_report_after.entries.length).toBeGreaterThan(
      0,
    )
    // Objective locations carry the strand the solver reported.
    const withLocation = parsed.data.objectives_report_after.entries.find(
      (e) => e.locations.length > 0,
    )
    expect(withLocation?.locations[0].strand).toBe(1)
  })

  it('keeps every field the fixture has', () => {
    const parsed = processResultSchema.parse(realResult)
    for (const key of Object.keys(realResult)) {
      expect(parsed).toHaveProperty(key)
    }
  })

  it('reads a saved server run with its run record', () => {
    const parsed = processResultSchema.parse({
      ...realResult,
      run_record: PYTHON_RUN_RECORD,
    })
    expect(parsed.run_record?.versions.dnachisel).toBe('3.2.16')
  })

  it('rejects a result whose sequences are empty', () => {
    const empty = {
      ...realResult,
      optimized_sequence: '',
      seq5: '',
      seq3: '',
    }
    expect(processResultSchema.safeParse(empty).success).toBe(false)
  })
})

describe('jobErrorSchema', () => {
  it('keeps the codes a browser run reports', () => {
    for (const code of ['invalid_input', 'backend', 'cancelled', 'not_found']) {
      const parsed = jobErrorSchema.parse({
        code,
        message: 'x',
        retriable: false,
      })
      expect(parsed.code).toBe(code)
    }
  })

  it('reads a code from the retired server backends as unknown', () => {
    const parsed = jobErrorSchema.parse({
      code: 'rate_limited',
      message: 'x',
      retriable: true,
    })
    expect(parsed.code).toBe('unknown')
  })
})
