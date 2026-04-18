import { GENETIC_CODE } from '@/lib/bio/genetic-code'

export type AaClass =
  | 'hydrophobic'
  | 'polar'
  | 'acidic'
  | 'basic'
  | 'special'
  | 'stop'

export const AA_CLASS_INDEX: Record<AaClass, number> = {
  hydrophobic: 0,
  polar: 1,
  acidic: 2,
  basic: 3,
  special: 4,
  stop: 5,
}

// Kyte-Doolittle-style grouping. Colors tuned for dark+light backgrounds.
// Colors are sRGB triplets in 0..1.
export const AA_CLASS_COLORS: Record<AaClass, [number, number, number]> = {
  hydrophobic: [0.56, 0.72, 0.88], // soft blue
  polar: [0.52, 0.82, 0.68], // mint
  acidic: [0.95, 0.55, 0.52], // coral
  basic: [0.69, 0.58, 0.92], // lilac
  special: [0.97, 0.82, 0.49], // amber
  stop: [0.35, 0.37, 0.42], // graphite
}

const AA_TO_CLASS: Record<string, AaClass> = {
  // hydrophobic
  A: 'hydrophobic',
  V: 'hydrophobic',
  L: 'hydrophobic',
  I: 'hydrophobic',
  M: 'hydrophobic',
  F: 'hydrophobic',
  W: 'hydrophobic',
  Y: 'hydrophobic',
  // polar
  S: 'polar',
  T: 'polar',
  N: 'polar',
  Q: 'polar',
  // acidic
  D: 'acidic',
  E: 'acidic',
  // basic
  K: 'basic',
  R: 'basic',
  H: 'basic',
  // special
  C: 'special',
  G: 'special',
  P: 'special',
  // stop
  '*': 'stop',
}

export function aaToClassIndex(aa: string): number {
  const cls = AA_TO_CLASS[aa]
  return cls ? AA_CLASS_INDEX[cls] : AA_CLASS_INDEX.special
}

/** Translate a codon to its amino acid class index. `X` (unknown) → special. */
export function codonToClassIndex(codon: string): number {
  if (codon.length !== 3) return AA_CLASS_INDEX.special
  const aa = GENETIC_CODE[codon.toUpperCase().replace(/U/g, 'T')]
  return aa ? aaToClassIndex(aa) : AA_CLASS_INDEX.special
}
