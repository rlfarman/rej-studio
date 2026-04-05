/**
 * Codon usage tables — frequency per thousand codons.
 *
 * Reference values from the Kazusa Codon Usage Database
 * (http://www.kazusa.or.jp/codon/) — standard public reference for human
 * and mouse codon bias. Values are approximate and intended for relative
 * comparison of synonymous codons, not absolute prediction.
 */
import { GENETIC_CODE } from './genetic-code'
import type { Species } from './species'

type CodonFreq = Record<string, number>

// Human (Homo sapiens)
const HUMAN: CodonFreq = {
  TTT: 17.6,
  TTC: 20.3,
  TTA: 7.7,
  TTG: 12.9,
  CTT: 13.2,
  CTC: 19.6,
  CTA: 7.2,
  CTG: 39.6,
  ATT: 16.0,
  ATC: 20.8,
  ATA: 7.5,
  ATG: 22.0,
  GTT: 11.0,
  GTC: 14.5,
  GTA: 7.1,
  GTG: 28.1,
  TCT: 15.2,
  TCC: 17.7,
  TCA: 12.2,
  TCG: 4.4,
  CCT: 17.5,
  CCC: 19.8,
  CCA: 16.9,
  CCG: 6.9,
  ACT: 13.1,
  ACC: 18.9,
  ACA: 15.1,
  ACG: 6.1,
  GCT: 18.4,
  GCC: 27.7,
  GCA: 15.8,
  GCG: 7.4,
  TAT: 12.2,
  TAC: 15.3,
  TAA: 1.0,
  TAG: 0.8,
  CAT: 10.9,
  CAC: 15.1,
  CAA: 12.3,
  CAG: 34.2,
  AAT: 17.0,
  AAC: 19.1,
  AAA: 24.4,
  AAG: 31.9,
  GAT: 21.8,
  GAC: 25.1,
  GAA: 29.0,
  GAG: 39.6,
  TGT: 10.6,
  TGC: 12.6,
  TGA: 1.6,
  TGG: 13.2,
  CGT: 4.5,
  CGC: 10.4,
  CGA: 6.2,
  CGG: 11.4,
  AGT: 12.1,
  AGC: 19.5,
  AGA: 12.2,
  AGG: 12.0,
  GGT: 10.8,
  GGC: 22.2,
  GGA: 16.5,
  GGG: 16.5,
}

// Mouse (Mus musculus)
const MOUSE: CodonFreq = {
  TTT: 17.2,
  TTC: 21.8,
  TTA: 6.6,
  TTG: 13.4,
  CTT: 13.4,
  CTC: 20.2,
  CTA: 8.1,
  CTG: 39.5,
  ATT: 15.4,
  ATC: 22.5,
  ATA: 7.4,
  ATG: 22.8,
  GTT: 10.7,
  GTC: 15.4,
  GTA: 7.4,
  GTG: 28.4,
  TCT: 16.2,
  TCC: 18.1,
  TCA: 11.8,
  TCG: 4.2,
  CCT: 18.4,
  CCC: 18.2,
  CCA: 17.3,
  CCG: 6.2,
  ACT: 13.7,
  ACC: 19.2,
  ACA: 16.0,
  ACG: 5.6,
  GCT: 20.0,
  GCC: 26.0,
  GCA: 16.0,
  GCG: 6.4,
  TAT: 12.2,
  TAC: 16.1,
  TAA: 1.0,
  TAG: 0.8,
  CAT: 10.6,
  CAC: 15.3,
  CAA: 11.8,
  CAG: 34.1,
  AAT: 15.6,
  AAC: 20.0,
  AAA: 21.9,
  AAG: 33.6,
  GAT: 21.0,
  GAC: 26.0,
  GAA: 27.0,
  GAG: 39.4,
  TGT: 11.4,
  TGC: 12.2,
  TGA: 1.6,
  TGG: 12.5,
  CGT: 4.7,
  CGC: 9.4,
  CGA: 6.6,
  CGG: 10.2,
  AGT: 13.4,
  AGC: 19.4,
  AGA: 12.1,
  AGG: 12.2,
  GGT: 11.4,
  GGC: 21.2,
  GGA: 16.8,
  GGG: 15.2,
}

const TABLES: Record<Species, CodonFreq> = {
  human: HUMAN,
  mouse: MOUSE,
}

export function getCodonUsage(species: Species): CodonFreq {
  return TABLES[species]
}

/**
 * Relative codon preference within its amino-acid synonymous group:
 * returns a value in [0, 1] where 1 = most-preferred synonymous codon
 * for that AA and 0 = least-preferred.
 */
export function getRelativePreference(
  codon: string,
  species: Species,
): number | null {
  const table = TABLES[species]
  const aa = GENETIC_CODE[codon]
  if (!aa || !(codon in table)) return null

  let maxFreq = 0
  for (const [c, a] of Object.entries(GENETIC_CODE)) {
    if (a === aa && table[c] > maxFreq) maxFreq = table[c]
  }
  if (maxFreq === 0) return null
  return table[codon] / maxFreq
}
