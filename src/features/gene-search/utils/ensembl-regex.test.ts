import { describe, expect, it } from 'vitest'

import { ENSG_REGEX, ENST_REGEX } from './ensembl-regex'

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
