import { describe, expect, it } from 'vite-plus/test'

import { ENSG_REGEX, ENST_REGEX, normalizeEnsemblId } from './ensembl-regex'

describe('ENST_REGEX', () => {
  it('matches human transcript IDs', () => {
    expect(ENST_REGEX.test('ENST00000012345')).toBe(true)
  })

  it('matches mouse transcript IDs', () => {
    expect(ENST_REGEX.test('ENSMUST00000012345')).toBe(true)
  })

  it('rejects gene IDs', () => {
    expect(ENST_REGEX.test('ENSG00000012345')).toBe(false)
  })

  it('rejects partial match', () => {
    expect(ENST_REGEX.test('xENST00000012345')).toBe(false)
  })

  it('rejects IDs without digits', () => {
    expect(ENST_REGEX.test('ENST')).toBe(false)
  })

  it('rejects IDs with trailing text', () => {
    expect(ENST_REGEX.test('ENST00000012345abc')).toBe(false)
  })
})

describe('ENSG_REGEX', () => {
  it('matches human gene IDs', () => {
    expect(ENSG_REGEX.test('ENSG00000012345')).toBe(true)
  })

  it('matches mouse gene IDs', () => {
    expect(ENSG_REGEX.test('ENSMUSG00000012345')).toBe(true)
  })

  it('rejects transcript IDs', () => {
    expect(ENSG_REGEX.test('ENST00000012345')).toBe(false)
  })

  it('rejects IDs without digits', () => {
    expect(ENSG_REGEX.test('ENSG')).toBe(false)
  })
})

// Ensembl prints ids with a version suffix and people paste them in any
// case; both used to fall through to the text search and match nothing.
describe('lowercase and versioned ids', () => {
  it('matches a lowercase gene ID', () => {
    expect(ENSG_REGEX.test('ensg00000141510')).toBe(true)
  })

  it('matches a lowercase transcript ID', () => {
    expect(ENST_REGEX.test('enst00000269305')).toBe(true)
  })

  it('matches a versioned transcript ID', () => {
    expect(ENST_REGEX.test('ENST00000269305.9')).toBe(true)
  })

  it('matches a versioned gene ID', () => {
    expect(ENSG_REGEX.test('ENSG00000141510.17')).toBe(true)
  })

  it('still rejects a non-numeric version suffix', () => {
    expect(ENST_REGEX.test('ENST00000269305.x')).toBe(false)
  })

  it('normalizes to the corpus key', () => {
    expect(normalizeEnsemblId(' enst00000269305.9 ')).toBe('ENST00000269305')
    expect(normalizeEnsemblId('ENSG00000141510')).toBe('ENSG00000141510')
  })
})
