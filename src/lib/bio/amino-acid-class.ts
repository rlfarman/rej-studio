/**
 * Amino-acid class groupings for visual encoding (ribbon mid-zoom LOD).
 *
 * Classes (6):
 *  0 hydrophobic  — A V L I M F W P
 *  1 polar        — S T N Q G C Y
 *  2 acidic       — D E
 *  3 basic        — K R H
 *  4 special      — (fallback for unusual / ambiguous)
 *  5 stop         — *
 *
 * Returned as a small integer per codon so we can upload to a 1D R8 texture
 * and let the shader pick a color from a 6-entry palette uniform.
 */

export const AA_CLASS_COUNT = 6

const CLASS: Record<string, number> = {
  A: 0,
  V: 0,
  L: 0,
  I: 0,
  M: 0,
  F: 0,
  W: 0,
  P: 0,
  S: 1,
  T: 1,
  N: 1,
  Q: 1,
  G: 1,
  C: 1,
  Y: 1,
  D: 2,
  E: 2,
  K: 3,
  R: 3,
  H: 3,
  '*': 5,
}

export function classForAminoAcid(aa: string): number {
  return CLASS[aa] ?? 4
}

/** Palette (sRGB 0..1 triplets, 6 × 3). Tuned for a dark background. */
export const AA_CLASS_PALETTE: ReadonlyArray<
  readonly [number, number, number]
> = [
  [0.36, 0.64, 0.95], // hydrophobic — cool blue
  [0.54, 0.84, 0.6], // polar — sage
  [0.97, 0.47, 0.45], // acidic — coral red
  [0.69, 0.53, 0.94], // basic — violet
  [0.85, 0.82, 0.7], // special — warm neutral
  [0.55, 0.55, 0.6], // stop — dim grey
]
