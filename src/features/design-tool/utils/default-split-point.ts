import { rankInducibleWggwByBalance } from '@/lib/bio/sequence-utils'
import { AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'

/**
 * Pick the initial splice-junction position for a given coding sequence.
 *
 * For sequences that need AAV splitting (length > AAV_PACKAGING_LIMIT), use
 * the balance-ranked best WGGW-capable cut when one exists — that's the
 * position a user looking at the isoform's split preview would expect. For
 * shorter sequences, or when no inducible WGGW sites exist, fall back to
 * the midpoint.
 *
 * Used on page load (when routing in with an isoform) and on paste/upload
 * (when the user supplies their own sequence) so both entry points yield
 * the same default.
 */
export function pickDefaultSplitPoint(sequence: string): number {
  const length = sequence.length
  if (length < 2) return 1
  const midpoint = Math.floor(length / 2)
  if (length <= AAV_PACKAGING_LIMIT) return midpoint
  const ranked = rankInducibleWggwByBalance(sequence)
  return ranked[0]?.position ?? midpoint
}

/**
 * Pick the default set of splice positions for a given CDS. Sequences that
 * exceed 2× the AAV packaging limit can't fit in two AAVs even with one
 * cut, so we suggest two splices (triple-AAV cassette). Otherwise, one
 * splice (or zero, for sequences that already fit in a single AAV).
 */
export function pickDefaultSplitPoints(sequence: string): number[] {
  const length = sequence.length
  if (length < 2) return [1]
  if (length > AAV_PACKAGING_LIMIT * 2) {
    return [Math.floor(length / 3), Math.floor((length * 2) / 3)]
  }
  return [pickDefaultSplitPoint(sequence)]
}
