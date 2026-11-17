import { describe, expect, it } from 'vite-plus/test'

import { GENETIC_CODE } from '@/lib/bio/genetic-code'

import { getRelativePreference } from './codon-preference'

describe('getRelativePreference', () => {
  it('covers every codon in both species', () => {
    for (const codon of Object.keys(GENETIC_CODE)) {
      for (const species of ['human', 'mouse'] as const) {
        const preference = getRelativePreference(codon, species)
        expect(preference, `${species} ${codon}`).not.toBeNull()
        expect(preference).toBeGreaterThan(0)
        expect(preference).toBeLessThanOrEqual(1)
      }
    }
  })

  it('gives 1 to the most-used synonym of each amino acid', () => {
    const byAminoAcid = new Map<string, string[]>()
    for (const [codon, aminoAcid] of Object.entries(GENETIC_CODE)) {
      byAminoAcid.set(aminoAcid, [...(byAminoAcid.get(aminoAcid) ?? []), codon])
    }
    for (const [aminoAcid, codons] of byAminoAcid) {
      for (const species of ['human', 'mouse'] as const) {
        const best = codons.map(
          (codon) => getRelativePreference(codon, species) ?? 0,
        )
        expect(Math.max(...best), `${species} ${aminoAcid}`).toBe(1)
      }
    }
  })

  it('reads RNA and lower case as the same codon', () => {
    expect(getRelativePreference('cug', 'human')).toBe(
      getRelativePreference('CTG', 'human'),
    )
  })

  it('has no entry for anything that is not a codon', () => {
    for (const value of ['', 'AT', 'XYZ', 'ATGC']) {
      expect(getRelativePreference(value, 'human')).toBeNull()
    }
  })

  it('ranks mouse arginine AGA level with AGG', () => {
    // The table the crate replaced ranked AGG above AGA in mouse, which is
    // why reverse translation disagreed with the optimizer. In the crate's
    // tables the two are used equally often, so both are preferred codons —
    // and the tie goes to AGA (see rust/optimizer/src/reverse_translate.rs).
    expect(getRelativePreference('AGA', 'mouse')).toBe(1)
    expect(getRelativePreference('AGG', 'mouse')).toBe(1)
  })
})
