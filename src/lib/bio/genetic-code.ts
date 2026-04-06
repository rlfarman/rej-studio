/**
 * Standard genetic code (table 1) — codon → single-letter amino acid.
 * `*` denotes stop codons.
 */
export const GENETIC_CODE: Record<string, string> = {
  TTT: 'F',
  TTC: 'F',
  TTA: 'L',
  TTG: 'L',
  CTT: 'L',
  CTC: 'L',
  CTA: 'L',
  CTG: 'L',
  ATT: 'I',
  ATC: 'I',
  ATA: 'I',
  ATG: 'M',
  GTT: 'V',
  GTC: 'V',
  GTA: 'V',
  GTG: 'V',
  TCT: 'S',
  TCC: 'S',
  TCA: 'S',
  TCG: 'S',
  CCT: 'P',
  CCC: 'P',
  CCA: 'P',
  CCG: 'P',
  ACT: 'T',
  ACC: 'T',
  ACA: 'T',
  ACG: 'T',
  GCT: 'A',
  GCC: 'A',
  GCA: 'A',
  GCG: 'A',
  TAT: 'Y',
  TAC: 'Y',
  TAA: '*',
  TAG: '*',
  CAT: 'H',
  CAC: 'H',
  CAA: 'Q',
  CAG: 'Q',
  AAT: 'N',
  AAC: 'N',
  AAA: 'K',
  AAG: 'K',
  GAT: 'D',
  GAC: 'D',
  GAA: 'E',
  GAG: 'E',
  TGT: 'C',
  TGC: 'C',
  TGA: '*',
  TGG: 'W',
  CGT: 'R',
  CGC: 'R',
  CGA: 'R',
  CGG: 'R',
  AGT: 'S',
  AGC: 'S',
  AGA: 'R',
  AGG: 'R',
  GGT: 'G',
  GGC: 'G',
  GGA: 'G',
  GGG: 'G',
}

export const AMINO_ACID_NAMES: Record<string, string> = {
  A: 'Ala',
  R: 'Arg',
  N: 'Asn',
  D: 'Asp',
  C: 'Cys',
  E: 'Glu',
  Q: 'Gln',
  G: 'Gly',
  H: 'His',
  I: 'Ile',
  L: 'Leu',
  K: 'Lys',
  M: 'Met',
  F: 'Phe',
  P: 'Pro',
  S: 'Ser',
  T: 'Thr',
  W: 'Trp',
  Y: 'Tyr',
  V: 'Val',
  '*': 'Stop',
}

/** Translate a codon (3 chars, any case, T or U) to single-letter AA. */
export function translateCodon(codon: string): string | null {
  if (codon.length !== 3) return null
  const normalized = codon.toUpperCase().replace(/U/g, 'T')
  return GENETIC_CODE[normalized] ?? null
}

/** Split a sequence into codons (truncates trailing non-triplet bases). */
export function toCodons(seq: string): string[] {
  const n = seq.length - (seq.length % 3)
  const codons: string[] = []
  for (let i = 0; i < n; i += 3) codons.push(seq.slice(i, i + 3))
  return codons
}

/** Translate a full sequence to single-letter amino acids. */
function translate(seq: string): string {
  const codons = toCodons(seq)
  let out = ''
  for (const c of codons) {
    out += translateCodon(c) ?? 'X'
  }
  return out
}
