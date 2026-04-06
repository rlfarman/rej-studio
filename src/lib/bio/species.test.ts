import { describe, expect, it } from 'vitest'

import {
  geneHref,
  isSpecies,
  isSpeciesFilter,
  parseSpeciesParam,
} from './species'

describe('isSpecies', () => {
  it('returns true for human', () => {
    expect(isSpecies('human')).toBe(true)
  })
  it('returns true for mouse', () => {
    expect(isSpecies('mouse')).toBe(true)
  })
  it('returns false for both', () => {
    expect(isSpecies('both')).toBe(false)
  })
  it('returns false for arbitrary string', () => {
    expect(isSpecies('dog')).toBe(false)
  })
})

describe('isSpeciesFilter', () => {
  it('returns true for human, mouse, both', () => {
    expect(isSpeciesFilter('human')).toBe(true)
    expect(isSpeciesFilter('mouse')).toBe(true)
    expect(isSpeciesFilter('both')).toBe(true)
  })
  it('returns false for invalid', () => {
    expect(isSpeciesFilter('dog')).toBe(false)
  })
})

describe('geneHref', () => {
  it('returns path with just symbol', () => {
    expect(geneHref('BRCA1')).toBe('/genes/BRCA1')
  })
  it('includes species param', () => {
    expect(geneHref('BRCA1', 'human')).toBe('/genes/BRCA1?species=human')
  })
  it('includes isoform param', () => {
    expect(geneHref('BRCA1', undefined, 'ENST00000001')).toBe(
      '/genes/BRCA1?isoform=ENST00000001',
    )
  })
  it('includes both params', () => {
    const href = geneHref('BRCA1', 'mouse', 'ENST00000001')
    expect(href).toContain('species=mouse')
    expect(href).toContain('isoform=ENST00000001')
  })
})

describe('parseSpeciesParam', () => {
  it('returns valid species filter', () => {
    expect(parseSpeciesParam('human')).toBe('human')
    expect(parseSpeciesParam('mouse')).toBe('mouse')
    expect(parseSpeciesParam('both')).toBe('both')
  })
  it('returns undefined for invalid', () => {
    expect(parseSpeciesParam('dog')).toBeUndefined()
  })
  it('returns undefined for undefined', () => {
    expect(parseSpeciesParam(undefined)).toBeUndefined()
  })
})
