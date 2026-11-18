import { describe, expect, it } from 'vite-plus/test'

import { validationSchema } from './form-schema'

const VALID_BASE = {
  sequenceType: 'dna' as const,
  codingSequence: 'ATGAAATGA',
  proteinSequence: '',
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
  spliceJunctionPositions: [3],
  selectedWggwSites: [],
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
    const result = parse({ codingSequence: seq, spliceJunctionPositions: [1] })
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
      spliceJunctionPositions: [3],
    })
    expect(result.success).toBe(false)
  })

  it('rejects spliceJunctionPosition > sequence length - 1', () => {
    const result = parse({
      codingSequence: 'ATGAAATGA',
      spliceJunctionPositions: [9], // length is 9, max is 8
    })
    expect(result.success).toBe(false)
  })

  it('accepts spliceJunctionPosition at max (length - 1)', () => {
    const result = parse({
      codingSequence: 'ATGAAATGA',
      spliceJunctionPositions: [8],
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

describe('validationSchema — protein input', () => {
  // The DNA the optimizer reverse-translates the protein to, which the form
  // holds by the time it can be submitted.
  const protein = (overrides: Record<string, unknown> = {}) =>
    parse({
      sequenceType: 'protein',
      codingSequence: 'ATGAAGGTGTGA',
      proteinSequence: 'MKV*',
      ...overrides,
    })

  const issuePaths = (result: ReturnType<typeof parse>) =>
    result.success ? [] : result.error.issues.map((i) => i.path.join('.'))

  it('accepts a valid protein with a species', () => {
    expect(protein().success).toBe(true)
  })

  it('accepts a protein without a trailing stop', () => {
    expect(protein({ proteinSequence: 'mkv' }).success).toBe(true)
  })

  it('requires a species for reverse translation', () => {
    expect(issuePaths(protein({ species: 'none' }))).toEqual(['species'])
  })

  it('rejects an empty protein', () => {
    expect(issuePaths(protein({ proteinSequence: '' }))).toContain(
      'proteinSequence',
    )
  })

  it('rejects characters that are not amino acids', () => {
    expect(issuePaths(protein({ proteinSequence: 'MKB1' }))).toContain(
      'proteinSequence',
    )
  })

  it('rejects an internal stop', () => {
    expect(issuePaths(protein({ proteinSequence: 'MK*V*' }))).toEqual([
      'proteinSequence',
    ])
  })

  it('rejects a protein over 16666 residues', () => {
    expect(
      issuePaths(protein({ proteinSequence: 'M'.repeat(16667) })),
    ).toContain('proteinSequence')
  })

  it('waits for the DNA the protein reverse-translates to', () => {
    // The crate owns reverse translation, so the DNA arrives asynchronously;
    // until it does there is nothing to design from.
    expect(issuePaths(protein({ codingSequence: '' }))).toContain(
      'proteinSequence',
    )
  })

  it('skips the DNA splice-position checks in protein mode', () => {
    // The split points are recomputed from the reverse-translated DNA, so a
    // stale position is not reported against the protein field.
    expect(protein({ spliceJunctionPositions: [500] }).success).toBe(true)
  })
})

describe('validationSchema — splice positions', () => {
  it('accepts a single split point', () => {
    expect(
      parse({
        codingSequence: 'ATGAAAAAATGA',
        spliceJunctionPositions: [6],
      }).success,
    ).toBe(true)
  })

  // The optimizer takes one split_point and answers 422 for more, so a
  // second position is blocked in the form rather than at the backend.
  it('rejects a second split point', () => {
    const result = parse({
      codingSequence: 'ATGAAAAAATGA',
      spliceJunctionPositions: [3, 6],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path)).toContainEqual([
        'spliceJunctionPositions',
        1,
      ])
      expect(result.error.issues[0].message).toMatch(/one split point/i)
    }
  })

  it('still rejects positions that are not strictly ascending', () => {
    const result = parse({
      codingSequence: 'ATGAAAAAATGA',
      spliceJunctionPositions: [6, 6],
    })
    expect(result.success).toBe(false)
  })
})
