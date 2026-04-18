/**
 * LOD (level of detail) thresholds expressed in bp-per-pixel. Smaller values
 * mean each base gets more pixels, i.e. zoomed in further.
 *
 * The shader uses smoothstep across these ranges, so there is never a snap —
 * the ribbon, codon tiles, and base letters all cross-fade.
 */

/** AA-class ribbon bands (always on as background; mix blends at deep zoom). */
export const LOD_CLASS_FADE_START_BP_PER_PX = 0.3
export const LOD_CLASS_FADE_END_BP_PER_PX = 0.1

/** Codon tile outlines (mid zoom). */
export const LOD_CODON_FADE_IN_BP_PER_PX = 1.0
export const LOD_CODON_FADE_OUT_BP_PER_PX = 0.4

/** Base-letter glyphs (deepest zoom — ~7–20 px per base). */
export const LOD_BASE_FADE_IN_BP_PER_PX = 0.22 // above this, no letters
export const LOD_BASE_FADE_OUT_BP_PER_PX = 0.12 // below this, fully visible

/** AA-letter glyphs (mid zoom — codon width ≥ ~10px). */
export const LOD_AA_FADE_IN_BP_PER_PX = 0.45
export const LOD_AA_FADE_OUT_BP_PER_PX = 0.25

/** Reasonable zoom bounds (per CSS pixel). */
export const MIN_BP_PER_PX = 0.1
export const MAX_BP_PER_PX = 200

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Given a CDS length and a viewport width in CSS pixels, return the
 * bp-per-pixel that fits the whole sequence with a little padding.
 */
export function fitBpPerPixel(length: number, widthPx: number): number {
  if (widthPx <= 0 || length <= 0) return 1
  return Math.max(MIN_BP_PER_PX, length / widthPx)
}

export function clampBpPerPixel(value: number): number {
  return Math.max(MIN_BP_PER_PX, Math.min(MAX_BP_PER_PX, value))
}

export function clampCenterBp(
  center: number,
  bpPerPixel: number,
  widthPx: number,
  length: number,
): number {
  const half = (widthPx * bpPerPixel) / 2
  return Math.max(half, Math.min(length - half, center))
}
