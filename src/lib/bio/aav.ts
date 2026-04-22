/**
 * AAV vector-count thresholds based on CDS length.
 *
 * A single AAV fits CDS < AAV_SINGLE_CDS_MAX.
 * Two AAVs (dual) cover CDS in [AAV_SINGLE_CDS_MAX, AAV_DUAL_CDS_MAX).
 * Three AAVs (triple) are needed for CDS ≥ AAV_DUAL_CDS_MAX.
 *
 * The commonly cited AAV total packaging capacity is ~4.7 kb (Dong et al.
 * 1996; Grieger & Samulski 2005), but realized CDS payload varies with the
 * regulatory elements in the construct. 4000 / 8000 bp are the lab's working
 * cutoffs for per-vector CDS, set independently of overhead math.
 */
export const AAV_SINGLE_CDS_MAX = 4000
export const AAV_DUAL_CDS_MAX = 8000

export type AavVectorCount = 1 | 2 | 3

export function cdsToVectorCount(cdsLength: number): AavVectorCount {
  if (cdsLength < AAV_SINGLE_CDS_MAX) return 1
  if (cdsLength < AAV_DUAL_CDS_MAX) return 2
  return 3
}
