import { describe, expect, it } from 'vite-plus/test'

import type { ObjectivesReport } from '@/features/design-tool/types/process-result'

import { computeCai, deriveKeyMetrics } from './objective-metrics'

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
      caiObjectiveScore: null,
      kmerScore: null,
      kmerPassed: false,
    })
  })

  it('keeps the MaximizeCAI entry under its own name — it is a score, not a CAI', () => {
    const metrics = deriveKeyMetrics(
      makeReport([
        {
          objective: 'MaximizeCAI(human)',
          passes: false,
          score: -84.899,
          message: '',
          locations: [],
        },
      ]),
    )
    expect(metrics.caiObjectiveScore).toBe(-84.899)
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

// CAI is a ratio in [0, 1]. The panel used to show the MaximizeCAI objective
// score under that name ("CAI -84.899 → -37.699"), which reads as a broken
// pipeline and gets copied into slides as a CAI.
describe('computeCai', () => {
  it('is 1 for a sequence built entirely from each species\u2019 preferred codons', () => {
    // ATG (Met) and TGG (Trp) have no synonyms; AAG/CTG are the preferred
    // Lys/Leu codons in both tables.
    expect(computeCai('ATGAAGCTGTGG', 'human')).toBeCloseTo(1, 10)
  })

  it('drops below 1 for a rare synonym, and stays inside 0\u20131', () => {
    // AAA is the rarer Lys codon (0.754 in human).
    const cai = computeCai('ATGAAACTGTGG', 'human')
    expect(cai).not.toBeNull()
    expect(cai!).toBeGreaterThan(0)
    expect(cai!).toBeLessThan(1)
    expect(cai!).toBeCloseTo(Math.pow(0.754386, 1 / 4), 5)
  })

  it('ignores the stop codon, which has no synonymous choice to score', () => {
    expect(computeCai('ATGAAGCTGTGGTAA', 'human')).toBeCloseTo(
      computeCai('ATGAAGCTGTGG', 'human')!,
      10,
    )
  })

  it('has nothing to report for a sequence with no scorable codon', () => {
    expect(computeCai('', 'human')).toBeNull()
    expect(computeCai('TAA', 'human')).toBeNull()
    expect(computeCai('NNN', 'mouse')).toBeNull()
  })
})
