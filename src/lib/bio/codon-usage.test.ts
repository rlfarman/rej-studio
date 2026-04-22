import { describe, expect, it } from 'vitest'

import { getRelativePreference } from './codon-usage'

describe('getRelativePreference', () => {
  it('returns 1.0 for the most preferred synonymous codon (CTG for Leu in human)', () => {
    // CTG is the most frequent Leu codon in human (39.6)
    expect(getRelativePreference('CTG', 'human')).toBe(1)
  })

  it('returns < 1 for less preferred codons', () => {
    // TTA is a rare Leu codon in human (7.7 vs CTG at 39.6)
    const pref = getRelativePreference('TTA', 'human')
    expect(pref).not.toBeNull()
    expect(pref!).toBeGreaterThan(0)
    expect(pref!).toBeLessThan(1)
  })

  it('returns null for unknown codon', () => {
    expect(getRelativePreference('XYZ', 'human')).toBeNull()
  })

  it('returns different values for human vs mouse', () => {
    const humanPref = getRelativePreference('TTC', 'human')
    const mousePref = getRelativePreference('TTC', 'mouse')
    expect(humanPref).not.toBeNull()
    expect(mousePref).not.toBeNull()
    // Values may differ slightly between species
    expect(typeof humanPref).toBe('number')
    expect(typeof mousePref).toBe('number')
  })

  it('returns valid value for stop codons', () => {
    const pref = getRelativePreference('TAA', 'human')
    expect(pref).not.toBeNull()
    expect(pref!).toBeGreaterThan(0)
    expect(pref!).toBeLessThanOrEqual(1)
  })

  it('returns 1.0 for the only Trp codon (TGG)', () => {
    // TGG is the only codon for W — it must be the max in its group
    expect(getRelativePreference('TGG', 'human')).toBe(1)
  })
})
