import { describe, expect, it } from 'vitest'

import { validationSchema } from './form-schema'

const VALID_BASE = {
  codingSequence: 'ATGAAATGA',
  name: 'Test Gene',
  species: 'human' as const,
  codonOptimizeWeight: 50,
  removeCrypticSpliceSites: false,
  removeCrypticSpliceSitesWeight: 50,
  minimizeCpgs: false,
  minimizeCpgsWeight: 50,
  reduceKmerComplexity: false,
  reduceKmerComplexityWeight: 50,
  enforceGcContent: false,
  '5PrimeStimulatoryIntron': false,
  '3PrimeStimulatoryIntron': false,
  spliceJunctionPosition: 3,
}

function parse(overrides: Record<string, unknown> = {}) {
  return validationSchema.safeParse({ ...VALID_BASE, ...overrides })
}

describe('validationSchema', () => {
  it('accepts a valid CDS', () => {
    const result = parse()
    expect(result.success).toBe(true)
  })

  it('transforms sequence to uppercase', () => {
    const result = parse({ codingSequence: 'atgaaatga' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.codingSequence).toBe('ATGAAATGA')
    }
  })

  it('rejects empty coding sequence', () => {
    const result = parse({ codingSequence: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid nucleotides', () => {
    const result = parse({ codingSequence: 'ATGXYZNTGA' })
    expect(result.success).toBe(false)
  })

  it('rejects sequence over 50000 chars', () => {
    const seq = 'ATG' + 'AAA'.repeat(16666) + 'TGA'
    const result = parse({ codingSequence: seq, spliceJunctionPosition: 1 })
    expect(result.success).toBe(false)
  })

  it('rejects sequence not multiple of 3', () => {
    const result = parse({ codingSequence: 'ATGAA' })
    expect(result.success).toBe(false)
  })

  it('rejects missing start codon', () => {
    const result = parse({ codingSequence: 'GGGAAATGA' })
    expect(result.success).toBe(false)
  })

  it('accepts AUG as start codon (RNA)', () => {
    const result = parse({ codingSequence: 'AUGAAAUAA' })
    expect(result.success).toBe(true)
  })

  it('rejects missing stop codon', () => {
    const result = parse({ codingSequence: 'ATGAAAGGG' })
    expect(result.success).toBe(false)
  })

  it('accepts all three stop codons', () => {
    expect(parse({ codingSequence: 'ATGAAATAA' }).success).toBe(true)
    expect(parse({ codingSequence: 'ATGAAATAG' }).success).toBe(true)
    expect(parse({ codingSequence: 'ATGAAATGA' }).success).toBe(true)
  })

  it('rejects internal stop codons', () => {
    // ATG + TAA (internal stop) + AAA + TGA
    const result = parse({
      codingSequence: 'ATGTAAAAATGA',
      spliceJunctionPosition: 3,
    })
    expect(result.success).toBe(false)
  })

  it('rejects spliceJunctionPosition > sequence length - 1', () => {
    const result = parse({
      codingSequence: 'ATGAAATGA',
      spliceJunctionPosition: 9, // length is 9, max is 8
    })
    expect(result.success).toBe(false)
  })

  it('accepts spliceJunctionPosition at max (length - 1)', () => {
    const result = parse({
      codingSequence: 'ATGAAATGA',
      spliceJunctionPosition: 8,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = parse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name over 250 chars', () => {
    const result = parse({ name: 'A'.repeat(251) })
    expect(result.success).toBe(false)
  })

  it('accepts species values', () => {
    expect(parse({ species: 'none' }).success).toBe(true)
    expect(parse({ species: 'human' }).success).toBe(true)
    expect(parse({ species: 'mouse' }).success).toBe(true)
  })

  it('rejects invalid species', () => {
    const result = parse({ species: 'dog' })
    expect(result.success).toBe(false)
  })

  it('rejects weight outside 0–100 range', () => {
    expect(parse({ codonOptimizeWeight: -1 }).success).toBe(false)
    expect(parse({ codonOptimizeWeight: 101 }).success).toBe(false)
  })
})
