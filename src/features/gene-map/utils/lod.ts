/**
 * LOD band weights as a function of bases-per-pixel (bpp).
 * Returns three non-negative weights that sum to 1 — ready to blend in shader.
 */

export interface LodWeights {
  far: number
  mid: number
  near: number
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function lodWeights(bpp: number): LodWeights {
  // At bpp ≥ 16 → pure FAR. At bpp ≤ 0.8 → pure NEAR. Cross-fade between.
  const far = smoothstep(6, 16, bpp)
  const near = 1 - smoothstep(0.8, 2, bpp)
  const mid = Math.max(0, 1 - far - near)
  const sum = far + mid + near || 1
  return { far: far / sum, mid: mid / sum, near: near / sum }
}

/** Horizontal pan: returns new offset, clamped. */
export function clampPan(
  offset: number,
  viewportBases: number,
  totalBases: number,
): number {
  const min = 0
  const max = Math.max(0, totalBases - viewportBases)
  return Math.max(min, Math.min(max, offset))
}

/** bpp bounds: zoom in enough to see individual letters clearly; zoom out to see whole gene. */
export function clampBpp(
  bpp: number,
  viewportWidthPx: number,
  totalBases: number,
): number {
  const minBpp = 0.05 // fit ~20 bases per pixel — letters big and readable
  const maxBpp = Math.max(minBpp + 0.01, totalBases / viewportWidthPx) // fit whole gene
  return Math.max(minBpp, Math.min(maxBpp, bpp))
}
