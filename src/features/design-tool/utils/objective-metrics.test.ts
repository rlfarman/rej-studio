import { describe, expect, it } from 'vitest'

import type { ObjectivesReport } from '@/features/design-tool/types/process-result'

import { deriveKeyMetrics } from './objective-metrics'

function makeReport(
  entries: ObjectivesReport['entries'] = [],
): ObjectivesReport {
  return { entries, total_score: null }
}

describe('deriveKeyMetrics', () => {
  it('returns zeros/nulls for empty report', () => {
    const metrics = deriveKeyMetrics(makeReport())
    expect(metrics).toEqual({
      spliceDonors: 0,
      spliceAcceptors: 0,
      caiScore: null,
      kmerScore: null,
      kmerPassed: false,
    })
  })

  it('extracts CAI score from MaximizeCAI entry', () => {
    const metrics = deriveKeyMetrics(
      makeReport([
        {
          objective: 'MaximizeCAI(human)',
          passes: true,
          score: 0.85,
          message: '',
          locations: [],
        },
      ]),
    )
    expect(metrics.caiScore).toBe(0.85)
  })

  it('extracts kmer score and pass status', () => {
    const metrics = deriveKeyMetrics(
      makeReport([
        {
          objective: 'UniquifyAllKmers(k=9)',
          passes: true,
          score: 0.92,
          message: '',
          locations: [],
        },
      ]),
    )
    expect(metrics.kmerScore).toBe(0.92)
    expect(metrics.kmerPassed).toBe(true)
  })

  it('counts splice donor patterns', () => {
    const metrics = deriveKeyMetrics(
      makeReport([
        {
          objective: 'AvoidPattern(Donor)(pattern:GT[AG]A)',
          passes: false,
          score: 0,
          message: '',
          locations: [
            { start: 10, end: 14, strand: null },
            { start: 50, end: 54, strand: null },
          ],
        },
      ]),
    )
    expect(metrics.spliceDonors).toBe(2)
    expect(metrics.spliceAcceptors).toBe(0)
  })

  it('counts splice acceptor patterns (non-donor, non-CG)', () => {
    const metrics = deriveKeyMetrics(
      makeReport([
        {
          objective: 'AvoidPattern(Acceptor)(pattern:TTTTTT)',
          passes: false,
          score: 0,
          message: '',
          locations: [{ start: 10, end: 16, strand: null }],
        },
      ]),
    )
    expect(metrics.spliceDonors).toBe(0)
    expect(metrics.spliceAcceptors).toBe(1)
  })

  it('skips CG pattern (CpG objective)', () => {
    const metrics = deriveKeyMetrics(
      makeReport([
        {
          objective: 'AvoidPattern(CpG)(pattern:CG)',
          passes: false,
          score: 0,
          message: '',
          locations: [
            { start: 10, end: 12, strand: null },
            { start: 20, end: 22, strand: null },
          ],
        },
      ]),
    )
    expect(metrics.spliceDonors).toBe(0)
    expect(metrics.spliceAcceptors).toBe(0)
  })
})
