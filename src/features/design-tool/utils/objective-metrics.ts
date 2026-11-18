/**
 * Derive key sequence-quality metrics from a structured ObjectivesReport.
 *
 * These metrics are more meaningful to synthesis / therapeutic workflows than
 * the raw DNAChisel score: splice-site counts, codon adaptation, and kmer
 * complexity. We read them directly off the typed report entries rather than
 * regex-parsing the human-readable text output.
 */

import type { ObjectivesReport } from '@/features/design-tool/types/process-result'
import type { Species } from '@/lib/bio/species'
import { toCodons, translateCodon } from '@/lib/bio/genetic-code'
import { getRelativePreference } from '@/features/design-tool/utils/codon-preference'

// Cryptic splice donor patterns the optimizer avoids (rust/optimizer/src). Anything else in the
// AvoidPattern block (except CG, which is the CpG objective) is treated as a
// splice acceptor pattern.
const DONOR_PATTERNS = new Set(['GT[AG]A', 'AAGTA', '[CTA]AG[GA]', 'CAG[GC]'])

const AVOID_PATTERN_RE = /^AvoidPattern.*?\(pattern:([^)]+)\)/

interface KeyMetrics {
  spliceDonors: number
  spliceAcceptors: number
  /**
   * The optimizer's own score for its MaximizeCAI objective — negative and
   * unbounded, not a codon adaptation index. A CAI is in [0, 1] by
   * definition, so this never travels under that name; `computeCai` below
   * works out the real thing from the sequence.
   */
  caiObjectiveScore: number | null
  kmerScore: number | null
  kmerPassed: boolean
}

export function deriveKeyMetrics(report: ObjectivesReport): KeyMetrics {
  let spliceDonors = 0
  let spliceAcceptors = 0
  let caiObjectiveScore: number | null = null
  let kmerScore: number | null = null
  let kmerPassed = false

  for (const entry of report.entries) {
    const obj = entry.objective
    if (obj.startsWith('MaximizeCAI')) {
      caiObjectiveScore = entry.score
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

  return {
    spliceDonors,
    spliceAcceptors,
    caiObjectiveScore,
    kmerScore,
    kmerPassed,
  }
}

/**
 * The codon adaptation index of a coding sequence for a species: the
 * geometric mean of each codon's relative preference, in (0, 1].
 *
 * Computed here from the same table the optimizer scored against
 * (`codon-preference.ts`), because the report's MaximizeCAI entry carries an
 * objective score rather than a CAI. Stop codons are excluded, as is
 * anything that isn't one of the 64 codons; `null` when nothing is left to
 * average.
 */
export function computeCai(sequence: string, species: Species): number | null {
  let sum = 0
  let counted = 0
  for (const codon of toCodons(sequence)) {
    const dna = codon.toUpperCase().replace(/U/g, 'T')
    if (translateCodon(dna) === '*') continue
    const weight = getRelativePreference(dna, species)
    if (weight === null || weight <= 0) continue
    sum += Math.log(weight)
    counted++
  }
  return counted === 0 ? null : Math.exp(sum / counted)
}
