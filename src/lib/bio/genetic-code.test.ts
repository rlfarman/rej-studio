import { describe, expect, it } from 'vitest'

import {
  AMINO_ACID_NAMES,
  GENETIC_CODE,
  toCodons,
  translateCodon,
} from './genetic-code'

// ---------------------------------------------------------------------------
// GENETIC_CODE table
// ---------------------------------------------------------------------------
describe('GENETIC_CODE', () => {
  it('contains all 64 codons', () => {
    expect(Object.keys(GENETIC_CODE)).toHaveLength(64)
  })

  it('has 3 stop codons (TAA, TAG, TGA)', () => {
    expect(GENETIC_CODE['TAA']).toBe('*')
    expect(GENETIC_CODE['TAG']).toBe('*')
    expect(GENETIC_CODE['TGA']).toBe('*')
  })

  it('maps ATG to M (methionine / start codon)', () => {
    expect(GENETIC_CODE['ATG']).toBe('M')
  })

  it('maps TGG to W (tryptophan — only codon)', () => {
    expect(GENETIC_CODE['TGG']).toBe('W')
  })
})

// ---------------------------------------------------------------------------
// AMINO_ACID_NAMES
// ---------------------------------------------------------------------------
describe('AMINO_ACID_NAMES', () => {
  it('has 20 amino acids plus stop', () => {
    expect(Object.keys(AMINO_ACID_NAMES)).toHaveLength(21)
  })

  it('maps * to Stop', () => {
    expect(AMINO_ACID_NAMES['*']).toBe('Stop')
  })

  it('maps M to Met', () => {
    expect(AMINO_ACID_NAMES['M']).toBe('Met')
  })
})

// ---------------------------------------------------------------------------
// translateCodon
// ---------------------------------------------------------------------------
describe('translateCodon', () => {
  it('translates ATG to M', () => {
    expect(translateCodon('ATG')).toBe('M')
  })

  it('handles RNA (AUG → M)', () => {
    expect(translateCodon('AUG')).toBe('M')
  })

  it('is case-insensitive', () => {
    expect(translateCodon('atg')).toBe('M')
  })

  it('returns null for non-3-character input', () => {
    expect(translateCodon('AT')).toBeNull()
    expect(translateCodon('ATGC')).toBeNull()
  })

  it('returns null for unknown codon', () => {
    expect(translateCodon('XYZ')).toBeNull()
  })

  it('translates stop codons to *', () => {
    expect(translateCodon('TAA')).toBe('*')
    expect(translateCodon('TAG')).toBe('*')
    expect(translateCodon('TGA')).toBe('*')
  })
})

// ---------------------------------------------------------------------------
// toCodons
// ---------------------------------------------------------------------------
describe('toCodons', () => {
  it('splits sequence into codons', () => {
    expect(toCodons('ATGAAATGA')).toEqual(['ATG', 'AAA', 'TGA'])
  })

  it('truncates trailing non-triplet bases', () => {
    expect(toCodons('ATGAA')).toEqual(['ATG'])
  })

  it('returns empty for empty string', () => {
    expect(toCodons('')).toEqual([])
  })

  it('returns empty for <3 characters', () => {
    expect(toCodons('AT')).toEqual([])
  })
})
