import type { Species } from '@/lib/bio/species'

import { CODON_RELATIVE_PREFERENCE } from './codon-preference.generated'

/**
 * How preferred a codon is within its amino acid's synonymous group, in
 * [0, 1]: 1 for the species' most-used synonym, towards 0 for the rarest.
 *
 * The numbers come from the Rust optimizer's own tables (generated at
 * `pnpm wasm:build`, checked by `pnpm wasm:verify`), so a chart shows the
 * preferences the design was actually scored against. There is no second
 * codon table in TypeScript.
 *
 * `null` for anything that is not one of the 64 codons.
 */
export function getRelativePreference(
  codon: string,
  species: Species,
): number | null {
  const table: Record<string, number> = CODON_RELATIVE_PREFERENCE[species]
  return table[codon.toUpperCase().replace(/U/g, 'T')] ?? null
}
