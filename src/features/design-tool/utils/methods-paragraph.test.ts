import { describe, expect, it } from 'vite-plus/test'

import type { RunRecord } from '@/features/design-tool/types/process-result'

import { buildMethodsParagraph, describeObjectives } from './methods-paragraph'

const RECORD: RunRecord = {
  record_version: 1,
  started_at: '2026-11-16T09:30:00Z',
  duration_seconds: 12.34,
  seed: 20261116,
  input: { sha256: 'a'.repeat(64), length: 1875 },
  options: {
    codon_optimize: 'h_sapiens',
    remove_cryptic_ss: true,
    minimize_CpGs: true,
    reduce_kmer_complexity: false,
    enforce_gc: true,
    stim_5: false,
    stim_3: false,
    split_point: 900,
  },
  versions: {
    algorithm_sha256: 'abc123def456',
    dnachisel: '3.2.16',
    python: '3.14.10',
  },
}

const record = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  ...RECORD,
  ...overrides,
})

describe('the optimization steps in prose', () => {
  it('names the species codon tables were taken from', () => {
    expect(describeObjectives({ codon_optimize: 'h_sapiens' })).toEqual([
      'codon optimization for Homo sapiens',
    ])
    expect(describeObjectives({ codon_optimize: 'm_musculus' })).toEqual([
      'codon optimization for Mus musculus',
    ])
    // The app sends these spellings; the backend's tables use the ones above.
    expect(describeObjectives({ codon_optimize: 'human' })).toEqual([
      'codon optimization for Homo sapiens',
    ])
    expect(describeObjectives({ codon_optimize: 'mouse' })).toEqual([
      'codon optimization for Mus musculus',
    ])
  })

  it('passes through a species code it does not have a name for', () => {
    expect(describeObjectives({ codon_optimize: 'd_rerio' })).toEqual([
      'codon optimization for d_rerio',
    ])
  })

  it('lists only the steps that were switched on', () => {
    const steps = describeObjectives(RECORD.options)

    expect(steps).toContain('cryptic splice site removal')
    expect(steps).toContain('CpG minimization')
    expect(steps).toContain('GC content enforcement')
    expect(steps).not.toContain('k-mer complexity reduction')
  })

  it('says nothing when nothing was switched on', () => {
    expect(describeObjectives({})).toEqual([])
    expect(describeObjectives({ codon_optimize: null })).toEqual([])
  })

  it('describes the stimulatory intron sites that were asked for', () => {
    expect(describeObjectives({ stim_5: true, stim_3: true })).toEqual([
      '5′ and 3′ stimulatory intron sites',
    ])
    expect(describeObjectives({ stim_5: true })).toEqual([
      'a 5′ stimulatory intron site',
    ])
    expect(describeObjectives({ stim_3: true })).toEqual([
      'a 3′ stimulatory intron site',
    ])
  })
})

describe('the methods paragraph', () => {
  it('states the input, the steps and the library that ran', () => {
    const text = buildMethodsParagraph(RECORD)

    expect(text).toContain('1,875 nt coding sequence')
    expect(text).toContain('SHA-256 aaaaaaaaaaaa…')
    expect(text).toContain(
      'codon optimization for Homo sapiens, cryptic splice site removal, ' +
        'CpG minimization and GC content enforcement',
    )
    expect(text).toContain('DNAChisel 3.2.16')
    expect(text).toContain('split after base 900')
  })

  it('gives the date and time in UTC, whatever the reader s timezone', () => {
    expect(buildMethodsParagraph(RECORD)).toContain(
      'on 16 November 2026 at 09:30 UTC',
    )
  })

  it('reports a sub-second run in milliseconds', () => {
    expect(buildMethodsParagraph(record({ duration_seconds: 0.42 }))).toContain(
      'took 420 ms',
    )
  })

  it('pins the code that produced the result', () => {
    expect(buildMethodsParagraph(RECORD)).toContain(
      'Run provenance: algorithm build abc123def456; Python 3.14.10.',
    )
  })

  it('treats a null commit and corpus as unknown, as FastAPI sends them', () => {
    const text = buildMethodsParagraph(
      record({
        versions: { ...RECORD.versions, commit: null },
        corpus_version: null,
      }),
    )

    expect(text).toContain(
      'Run provenance: algorithm build abc123def456; Python 3.14.10.',
    )
    expect(text).not.toContain('commit')
    expect(text).not.toContain('corpus')
  })

  it('names the commit and the corpus when the record has them', () => {
    const text = buildMethodsParagraph(
      record({
        versions: { ...RECORD.versions, commit: '05a8be17e9de9563ffe9a2' },
        corpus_version: 'v1',
      }),
    )

    expect(text).toContain('commit 05a8be1')
    // "loaded", because the record knows what the deployment was serving and
    // not where the sequence came from.
    expect(text).toContain('gene corpus v1 loaded')
    expect(text).not.toMatch(/from (the )?gene corpus/)
  })

  it('claims nothing the record does not contain', () => {
    const text = buildMethodsParagraph(RECORD)

    // The GC bounds live in the algorithm, not the record, so the paragraph
    // must not quote them. Nor may it invent a corpus or a commit.
    expect(text).not.toMatch(/35|60|%/)
    expect(text).not.toContain('corpus')
    expect(text).not.toContain('commit')
    // No step that was switched off.
    expect(text).not.toContain('k-mer')
    expect(text).not.toContain('stimulatory')
  })

  it('survives a record with no options and an unreadable timestamp', () => {
    const text = buildMethodsParagraph(
      record({ options: {}, started_at: 'not a date' }),
    )

    expect(text).toContain('1,875 nt coding sequence')
    expect(text).toContain('The run took 12.3 s.')
    expect(text).not.toContain('Invalid Date')
  })
})
