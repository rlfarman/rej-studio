import { describe, expect, it } from 'vitest'

import { findRestrictionSites } from './restriction-sites'

describe('findRestrictionSites', () => {
  it('returns empty for sequence with no sites', () => {
    expect(findRestrictionSites('AAAAAAAAAA')).toEqual([])
  })

  it('finds a single EcoRI site (GAATTC)', () => {
    const hits = findRestrictionSites('AAAGAATTCAAA')
    expect(hits).toEqual([{ enzyme: 'EcoRI', site: 'GAATTC', position: 4 }])
  })

  it('finds multiple different enzyme sites', () => {
    // EcoRI (GAATTC) + BamHI (GGATCC)
    const seq = 'GAATTCAAAGGATCC'
    const hits = findRestrictionSites(seq)
    const enzymes = hits.map((h) => h.enzyme)
    expect(enzymes).toContain('EcoRI')
    expect(enzymes).toContain('BamHI')
  })

  it('finds multiple occurrences of the same enzyme', () => {
    const seq = 'GAATTCAAAGAATTC'
    const hits = findRestrictionSites(seq)
    const ecori = hits.filter((h) => h.enzyme === 'EcoRI')
    expect(ecori).toHaveLength(2)
    expect(ecori[0].position).toBe(1)
    expect(ecori[1].position).toBe(10)
  })

  it('is case-insensitive', () => {
    const hits = findRestrictionSites('gaattc')
    expect(hits).toHaveLength(1)
    expect(hits[0].enzyme).toBe('EcoRI')
  })

  it('returns 1-based positions', () => {
    const hits = findRestrictionSites('GAATTC')
    expect(hits[0].position).toBe(1)
  })

  it('accepts custom enzyme list', () => {
    const custom = [{ name: 'TestEnzyme', site: 'AAAA' }]
    const hits = findRestrictionSites('TTAAAATT', custom)
    expect(hits).toEqual([{ enzyme: 'TestEnzyme', site: 'AAAA', position: 3 }])
  })

  it('finds NotI 8-base cutter (GCGGCCGC)', () => {
    const hits = findRestrictionSites('AAAGCGGCCGCAAA')
    expect(hits).toEqual([{ enzyme: 'NotI', site: 'GCGGCCGC', position: 4 }])
  })
})
