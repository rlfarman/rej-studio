/**
 * Derive key sequence-quality metrics from a structured ObjectivesReport.
 *
 * These metrics are more meaningful to synthesis / therapeutic workflows than
 * the raw DNAChisel score: splice-site counts, codon adaptation, and kmer
 * complexity. We read them directly off the typed report entries rather than
 * regex-parsing the human-readable text output.
 */

import type { ObjectivesReport } from '@/features/design-tool/types/process-result'

// Cryptic splice donor patterns used by api/algorithm.py. Anything else in the
// AvoidPattern block (except CG, which is the CpG objective) is treated as a
// splice acceptor pattern.
const DONOR_PATTERNS = new Set(['GT[AG]A', 'AAGTA', '[CTA]AG[GA]', 'CAG[GC]'])

const AVOID_PATTERN_RE = /^AvoidPattern.*?\(pattern:([^)]+)\)/

export interface KeyMetrics {
  spliceDonors: number
  spliceAcceptors: number
  caiScore: number | null
  kmerScore: number | null
  kmerPassed: boolean
}

export function deriveKeyMetrics(report: ObjectivesReport): KeyMetrics {
  let spliceDonors = 0
  let spliceAcceptors = 0
  let caiScore: number | null = null
  let kmerScore: number | null = null
  let kmerPassed = false

  for (const entry of report.entries) {
    const obj = entry.objective
    if (obj.startsWith('MaximizeCAI')) {
      caiScore = entry.score
      continue
    }
    if (obj.startsWith('UniquifyAllKmers')) {
      kmerScore = entry.score
      kmerPassed = entry.passes
      continue
    }
    const m = obj.match(AVOID_PATTERN_RE)
    if (!m) continue
    const pattern = m[1]
    if (pattern === 'CG') continue
    const count = entry.locations.length
    if (DONOR_PATTERNS.has(pattern)) {
      spliceDonors += count
    } else {
      spliceAcceptors += count
    }
  }

  return { spliceDonors, spliceAcceptors, caiScore, kmerScore, kmerPassed }
}
