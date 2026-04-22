import { describe, expect, it } from 'vitest'

import { cleanSequence, formatFasta, parseFasta } from './fasta'

// ---------------------------------------------------------------------------
// parseFasta
// ---------------------------------------------------------------------------
describe('parseFasta', () => {
  it('parses a single FASTA entry', () => {
    const input = '>gene1\nATGCATGC\nGGGTTT'
    const result = parseFasta(input)
    expect(result).toEqual([{ header: 'gene1', sequence: 'ATGCATGCGGGTTT' }])
  })

  it('parses multiple entries', () => {
    const input = '>gene1\nATGC\n>gene2\nGGGG'
    const result = parseFasta(input)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ header: 'gene1', sequence: 'ATGC' })
    expect(result[1]).toEqual({ header: 'gene2', sequence: 'GGGG' })
  })

  it('handles CRLF line endings', () => {
    const input = '>gene1\r\nATGC\r\nGGGG'
    const result = parseFasta(input)
    expect(result).toEqual([{ header: 'gene1', sequence: 'ATGCGGGG' }])
  })

  it('handles orphan sequence without header', () => {
    const input = 'ATGCATGC'
    const result = parseFasta(input)
    expect(result).toEqual([{ header: '', sequence: 'ATGCATGC' }])
  })

  it('returns empty for empty input', () => {
    expect(parseFasta('')).toEqual([])
  })

  it('trims whitespace from lines', () => {
    const input = '>gene1  \n  ATGC  '
    const result = parseFasta(input)
    expect(result[0].header).toBe('gene1')
    expect(result[0].sequence).toBe('ATGC')
  })
})

// ---------------------------------------------------------------------------
// cleanSequence
// ---------------------------------------------------------------------------
describe('cleanSequence', () => {
  it('strips FASTA headers and counts them', () => {
    const result = cleanSequence('>header\nATGC')
    expect(result.cleaned).toBe('ATGC')
    expect(result.removedHeaders).toBe(1)
  })

  it('strips line numbers', () => {
    const result = cleanSequence('1 ATGC\n10 GGGG')
    expect(result.cleaned).toBe('ATGCGGGG')
  })

  it('removes non-nucleotide characters', () => {
    const result = cleanSequence('ATG 123 XYZ CGG')
    expect(result.cleaned).toBe('ATGCGG')
    expect(result.removedChars).toBeGreaterThan(0)
  })

  it('uppercases output', () => {
    const result = cleanSequence('atgcatgc')
    expect(result.cleaned).toBe('ATGCATGC')
  })

  it('preserves U (RNA)', () => {
    const result = cleanSequence('AUGCAUGC')
    expect(result.cleaned).toBe('AUGCAUGC')
  })
})

// ---------------------------------------------------------------------------
// formatFasta
// ---------------------------------------------------------------------------
describe('formatFasta', () => {
  it('formats with default 80-char line width', () => {
    const seq = 'A'.repeat(160)
    const result = formatFasta('gene1', seq)
    const lines = result.split('\n')
    expect(lines[0]).toBe('>gene1')
    expect(lines[1]).toBe('A'.repeat(80))
    expect(lines[2]).toBe('A'.repeat(80))
  })

  it('handles short sequence without wrapping', () => {
    const result = formatFasta('gene1', 'ATGC')
    expect(result).toBe('>gene1\nATGC')
  })

  it('respects custom line width', () => {
    const seq = 'ATGCATGCATGC'
    const result = formatFasta('gene1', seq, 4)
    const lines = result.split('\n')
    expect(lines).toEqual(['>gene1', 'ATGC', 'ATGC', 'ATGC'])
  })

  it('handles empty sequence', () => {
    const result = formatFasta('gene1', '')
    expect(result).toBe('>gene1')
  })
})
