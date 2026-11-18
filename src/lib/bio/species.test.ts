import { describe, expect, it } from 'vite-plus/test'

import { isSpecies, isSpeciesFilter, parseSpeciesParam } from './species'

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

describe('parseSpeciesParam', () => {
  it('returns valid species filter', () => {
    expect(parseSpeciesParam('human')).toBe('human')
    expect(parseSpeciesParam('mouse')).toBe('mouse')
    expect(parseSpeciesParam('both')).toBe('both')
  })
  it('returns undefined for invalid', () => {
    expect(parseSpeciesParam('dog')).toBeUndefined()
  })
  it('returns undefined for undefined or a non-string', () => {
    expect(parseSpeciesParam(undefined)).toBeUndefined()
    expect(parseSpeciesParam(['human'])).toBeUndefined()
  })
})
