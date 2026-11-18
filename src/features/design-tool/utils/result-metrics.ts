/**
 * The numbers a finished design is summarized by: the metrics strip across
 * the top of the results panel, and the same values in the exported report.
 *
 * Computed in one place so the screen and the file can never disagree, and
 * read off the structured objectives report rather than the optimizer's text
 * summary — the text prints a rounded total and ticks only some of the
 * objectives, which is how the panel came to show two different totals three
 * lines apart.
 */

import type {
  ObjectivesReport,
  ProcessResult,
} from '@/features/design-tool/types/process-result'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { isSpecies } from '@/lib/bio/species'
import { computeGcPercent, countCpG } from '@/lib/bio/sequence-utils'
import {
  computeCai,
  deriveKeyMetrics,
  type KeyMetrics,
} from '@/features/design-tool/utils/objective-metrics'

/**
 * The objectives' total. The structured report carries it to full precision;
 * a result saved before the report existed has only the text, which prints it
 * rounded to two places.
 */
function totalScore(report: ObjectivesReport, text: string): number | null {
  if (report.total_score !== null) return report.total_score
  const match = text.match(/TOTAL OBJECTIVES SCORE:\s*([-\d.]+)/)
  return match ? Number.parseFloat(match[1]) : null
}

interface ResultMetrics {
  /** The optimizer's total objectives score, before and after. */
  score: { before: number | null; after: number | null }
  /** Null when the result carries no sequences to measure. */
  gc: { before: number; after: number } | null
  cpg: { before: number; after: number } | null
  /** Percent of bases unchanged from the input sequence. */
  identity: number | null
  /**
   * A real codon adaptation index, from the sequence and the species' codon
   * table. Null when no species was chosen: the report's MaximizeCAI entry
   * holds the optimizer's objective score instead, which is unbounded.
   */
  cai: { before: number | null; after: number | null } | null
  keyBefore: KeyMetrics
  keyAfter: KeyMetrics
}

/** Plain function — the React Compiler handles memoization. */
export function computeResultMetrics(
  result: ProcessResult,
  species: DesignToolSpecies,
): ResultMetrics {
  const score = {
    before: totalScore(
      result.objectives_report_before,
      result.objectives_before,
    ),
    after: totalScore(result.objectives_report_after, result.objectives_after),
  }
  const keyBefore = deriveKeyMetrics(result.objectives_report_before)
  const keyAfter = deriveKeyMetrics(result.objectives_report_after)
  const cai = isSpecies(species)
    ? {
        before: computeCai(result.original_sequence, species),
        after: computeCai(result.optimized_sequence, species),
      }
    : null

  const orig = result.original_sequence
  const opt = result.optimized_sequence
  if (!orig || !opt) {
    return {
      score,
      keyBefore,
      keyAfter,
      cai,
      gc: null,
      cpg: null,
      identity: null,
    }
  }

  let changed = 0
  const len = Math.min(orig.length, opt.length)
  for (let i = 0; i < len; i++) if (orig[i] !== opt[i]) changed++

  return {
    score,
    keyBefore,
    keyAfter,
    cai,
    gc: { before: computeGcPercent(orig), after: computeGcPercent(opt) },
    cpg: { before: countCpG(orig), after: countCpG(opt) },
    identity: len > 0 ? 100 - (changed / len) * 100 : 100,
  }
}
