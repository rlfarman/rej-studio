/**
 * Contract tests against the Python side.
 *
 * `__fixtures__/process-result.json` is a byte-copy of
 * `python/tests/fixtures/process-result.json` — the real output of a seeded
 * run, regenerated on the backend by
 * `uv run python -m python.tests.regenerate_fixtures`. If the Python models
 * move, this test fails here too instead of the drift showing up as
 * `undefined` in the results panel.
 */
import { describe, expect, it } from 'vitest'
import {
  jobStatusResponseSchema,
  processOptionsSchema,
  processResultSchema,
} from './backend-contract'
import realResult from './__fixtures__/process-result.json'

const BASE_OPTIONS = {
  codon_optimize: 'human',
  codon_optimize_weight: 1,
  remove_cryptic_ss: true,
  remove_cryptic_ss_weight: 1,
  minimize_CpGs: true,
  minimize_CpGs_weight: 1,
  reduce_kmer_complexity: true,
  reduce_kmer_complexity_weight: 1,
  enforce_gc: true,
  stim_5: true,
  stim_3: true,
  split_point: 51,
  selected_wggw_site: null,
  ensure_wggw: true,
  wggw_threshold: 300,
}

describe('processResultSchema', () => {
  it('parses a real backend result', () => {
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

describe('processOptionsSchema', () => {
  it('accepts the payload the form builds', () => {
    expect(processOptionsSchema.safeParse(BASE_OPTIONS).success).toBe(true)
  })

  // ProcessOptions is extra="forbid" on the Python side, so a key we don't
  // know about must never be forwarded.
  it('drops keys the backend would reject', () => {
    const parsed = processOptionsSchema.parse({
      ...BASE_OPTIONS,
      split_points: [51, 102],
      selected_wggw_sites: [null, null],
      made_up_option: true,
    })
    expect(parsed).not.toHaveProperty('split_points')
    expect(parsed).not.toHaveProperty('selected_wggw_sites')
    expect(parsed).not.toHaveProperty('made_up_option')
  })

  it('enforces the Python weight bounds', () => {
    expect(
      processOptionsSchema.safeParse({
        ...BASE_OPTIONS,
        codon_optimize_weight: 101,
      }).success,
    ).toBe(false)
    expect(
      processOptionsSchema.safeParse({
        ...BASE_OPTIONS,
        minimize_CpGs_weight: -1,
      }).success,
    ).toBe(false)
  })

  it('enforces the k-mer k bounds when k is sent', () => {
    expect(
      processOptionsSchema.safeParse({
        ...BASE_OPTIONS,
        reduce_kmer_complexity_k: 5,
      }).success,
    ).toBe(false)
    expect(
      processOptionsSchema.safeParse({
        ...BASE_OPTIONS,
        reduce_kmer_complexity_k: 10,
      }).success,
    ).toBe(true)
  })

  it('rejects a species the codon tables do not cover', () => {
    expect(
      processOptionsSchema.safeParse({
        ...BASE_OPTIONS,
        codon_optimize: 'octopus',
      }).success,
    ).toBe(false)
  })

  it('accepts a null split point (backend defaults to the midpoint)', () => {
    expect(
      processOptionsSchema.safeParse({ ...BASE_OPTIONS, split_point: null })
        .success,
    ).toBe(true)
  })

  it('validates a selected WGGW site against the Python bounds', () => {
    const site = {
      position: 49,
      motif_start: 49,
      motif: 'TGGA',
      hexamer_start: 49,
      original_codons: ['CTG', 'GAG'],
      new_codons: ['CTG', 'GAA'],
      new_hexamer: 'CTGGAA',
    }
    expect(
      processOptionsSchema.safeParse({
        ...BASE_OPTIONS,
        selected_wggw_site: site,
      }).success,
    ).toBe(true)
    // hexamer_start is 1-based on the Python side.
    expect(
      processOptionsSchema.safeParse({
        ...BASE_OPTIONS,
        selected_wggw_site: { ...site, hexamer_start: 0 },
      }).success,
    ).toBe(false)
    expect(
      processOptionsSchema.safeParse({
        ...BASE_OPTIONS,
        selected_wggw_site: { ...site, new_hexamer: 'CTGGAX' },
      }).success,
    ).toBe(false)
  })
})

describe('jobStatusResponseSchema', () => {
  it('parses a completed status wrapping the real result', () => {
    const parsed = jobStatusResponseSchema.safeParse({
      status: 'completed',
      result: realResult,
    })
    expect(parsed.success).toBe(true)
  })

  it('parses each lifecycle status the backend can return', () => {
    for (const status of [
      'running',
      'completed',
      'failed',
      'cancelled',
      'not_found',
    ]) {
      const payload =
        status === 'completed' ? { status, result: realResult } : { status }
      expect(jobStatusResponseSchema.safeParse(payload).success).toBe(true)
    }
  })

  it('keeps the backend error codes it documents', () => {
    for (const code of ['timeout', 'invalid_input', 'backend', 'cancelled']) {
      const parsed = jobStatusResponseSchema.parse({
        status: 'failed',
        error: { code, message: 'x', retriable: code === 'timeout' },
      })
      expect(parsed.error?.code).toBe(code)
    }
  })
})
