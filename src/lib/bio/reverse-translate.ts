import { GENETIC_CODE } from './genetic-code'
import { getRelativePreference } from './codon-usage'
import type { Species } from './species'

/** Standard amino acid single-letter codes (excludes stop `*`). */
export const AMINO_ACIDS = new Set('ACDEFGHIKLMNPQRSTVWY')

/** Valid characters in a protein sequence input (AAs + stop). */
export const PROTEIN_CHARS = /^[ACDEFGHIKLMNPQRSTVWY*]+$/i

/**
 * Build a reverse lookup: amino acid → list of DNA codons that encode it.
 * Computed once at module load.
 */
const AA_TO_CODONS: Record<string, string[]> = {}
for (const [codon, aa] of Object.entries(GENETIC_CODE)) {
  ;(AA_TO_CODONS[aa] ??= []).push(codon)
}

/**
 * For each amino acid, return the codon with the highest usage frequency
 * for the given species. Ties are broken by table insertion order (stable).
 */
function bestCodon(aa: string, species: Species): string {
  const codons = AA_TO_CODONS[aa]
  if (!codons || codons.length === 0) {
    throw new Error(`No codons found for amino acid "${aa}"`)
  }
  let best = codons[0]
  let bestPref = getRelativePreference(best, species) ?? 0
  for (let i = 1; i < codons.length; i++) {
    const pref = getRelativePreference(codons[i], species) ?? 0
    if (pref > bestPref) {
      best = codons[i]
      bestPref = pref
    }
  }
  return best
}

/**
 * Reverse-translate a protein sequence to DNA using the most-preferred
 * codons for the given species.
 *
 * - Input should contain only standard amino acid letters (case-insensitive).
 * - A trailing `*` (stop) is converted to the most-preferred stop codon.
 * - If the sequence does not end with `*`, a stop codon (TAA) is appended.
 * - The first amino acid should be M (methionine) — encoded as ATG.
 */
export function reverseTranslate(protein: string, species: Species): string {
  const upper = protein.toUpperCase().replace(/\s/g, '')
  if (upper.length === 0) return ''
  if (!PROTEIN_CHARS.test(upper)) {
    const invalid = [...new Set(upper.replace(/[ACDEFGHIKLMNPQRSTVWY*]/gi, ''))]
    throw new Error(`Invalid amino acid character(s): ${invalid.join(', ')}`)
  }

  let dna = ''
  for (const aa of upper) {
    if (aa === '*') {
      dna += bestCodon('*', species)
    } else {
      dna += bestCodon(aa, species)
    }
  }

  // Ensure the sequence ends with a stop codon
  const last3 = dna.slice(-3)
  if (last3 !== 'TAA' && last3 !== 'TAG' && last3 !== 'TGA') {
    dna += 'TAA'
  }

  return dna
}
