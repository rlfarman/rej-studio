import { describe, expect, it } from 'vite-plus/test'

import { getRelativePreference } from './codon-usage'
import { GENETIC_CODE, translate } from './genetic-code'
import { reverseTranslate } from './reverse-translate'
import type { Species } from './species'

const SPECIES: Species[] = ['human', 'mouse']
const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY'

describe('reverseTranslate', () => {
  it('returns an empty string for empty or whitespace-only input', () => {
    expect(reverseTranslate('', 'human')).toBe('')
    expect(reverseTranslate('  \n', 'human')).toBe('')
  })

  it.each(SPECIES)(
    'round-trips every amino acid back to the same protein (%s)',
    (species) => {
      const protein = `M${AMINO_ACIDS}*`
      expect(translate(reverseTranslate(protein, species))).toBe(protein)
    },
  )

  it('appends a TAA stop codon when the protein has no trailing stop', () => {
    const dna = reverseTranslate('MK', 'human')
    expect(dna).toHaveLength(9)
    expect(dna.slice(-3)).toBe('TAA')
    expect(translate(dna)).toBe('MK*')
  })

  it('does not add a second stop codon when the protein ends with *', () => {
    const dna = reverseTranslate('MK*', 'human')
    expect(dna).toHaveLength(9)
    expect(translate(dna)).toBe('MK*')
  })

  it('ignores case and whitespace', () => {
    expect(reverseTranslate('m k\n*', 'mouse')).toBe(
      reverseTranslate('MK*', 'mouse'),
    )
  })

  it.each(SPECIES)(
    'picks the most-preferred synonymous codon for each amino acid (%s)',
    (species) => {
      for (const aa of `${AMINO_ACIDS}*`) {
        const chosen = reverseTranslate(aa, species).slice(0, 3)
        const synonyms = Object.keys(GENETIC_CODE).filter(
          (codon) => GENETIC_CODE[codon] === aa,
        )
        const chosenPref = getRelativePreference(chosen, species) ?? 0
        for (const codon of synonyms) {
          expect(chosenPref).toBeGreaterThanOrEqual(
            getRelativePreference(codon, species) ?? 0,
          )
        }
      }
    },
  )

  it('rejects non-amino-acid characters and names each one once', () => {
    expect(() => reverseTranslate('MXBX', 'human')).toThrow(
      'Invalid amino acid character(s): X, B',
    )
  })
})
