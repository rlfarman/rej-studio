import { rankWggwByBalance } from '@/lib/bio/sequence-utils'
import { AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'
import { detectSequenceType } from '@/lib/bio/sequence-type'

/**
 * Pick the initial splice-junction position for a given coding sequence.
 *
 * For sequences that need AAV splitting (length > AAV_PACKAGING_LIMIT), use
 * the balance-ranked best WGGW cut when one exists — that's the position a
 * user looking at the isoform's split preview would expect. For shorter
 * sequences, or when no WGGW motifs exist, fall back to the midpoint.
 *
 * Used on page load (when routing in with an isoform) and on paste/upload
 * (when the user supplies their own sequence) so both entry points yield
 * the same default.
 */
export function pickDefaultSplitPoint(sequence: string): number {
  // Amino-acid input has no DNA yet — WGGW motifs don't exist on proteins —
  // so fall back to the midpoint of the reverse-translated length (× 3).
  if (detectSequenceType(sequence) === 'protein') {
    const dnaLen = sequence.length * 3
    if (dnaLen < 2) return 1
    return Math.floor(dnaLen / 2)
  }
  const length = sequence.length
  if (length < 2) return 1
  const midpoint = Math.floor(length / 2)
  if (length <= AAV_PACKAGING_LIMIT) return midpoint
  const ranked = rankWggwByBalance(sequence)
  return ranked[0]?.position ?? midpoint
}
