import { rankWggwByBalance } from '@/lib/bio/sequence-utils'
import { AAV_SINGLE_CDS_MAX } from '@/lib/bio/aav'

/**
 * Pick the initial splice-junction position for a given coding sequence.
 *
 * For sequences long enough to need an AAV split (length ≥ AAV_SINGLE_CDS_MAX),
 * use the balance-ranked best WGGW cut when one exists — that's the position a
 * user looking at the isoform's split preview would expect. For shorter
 * sequences, or when no WGGW motifs exist, fall back to the midpoint.
 *
 * Used on page load (when routing in with an isoform) and on paste/upload
 * (when the user supplies their own sequence) so both entry points yield
 * the same default.
 */
export function pickDefaultSplitPoint(sequence: string): number {
  const length = sequence.length
  if (length < 2) return 1
  const midpoint = Math.floor(length / 2)
  if (length < AAV_SINGLE_CDS_MAX) return midpoint
  const ranked = rankWggwByBalance(sequence)
  return ranked[0]?.position ?? midpoint
}
