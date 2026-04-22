import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/gene-search/api/isoform-queries', () => ({
  fetchIsoformsByGene: vi.fn(async () => []),
  fetchIsoformAndGeneByIsoformId: vi.fn(async () => undefined),
}))

// React.cache is a no-op wrapper in tests
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: (fn: Function) => fn }
})

import { getIsoformsByGene, getIsoformAndGeneByIsoformId } from './isoforms'

describe('getIsoformsByGene', () => {
  it('accepts valid gene ID', async () => {
    const result = await getIsoformsByGene('ENSG00000000001')
    expect(result).toEqual([])
  })

  it('rejects empty string', async () => {
    await expect(getIsoformsByGene('')).rejects.toThrow()
  })

  it('rejects ID over 100 chars', async () => {
    await expect(getIsoformsByGene('A'.repeat(101))).rejects.toThrow()
  })
})

describe('getIsoformAndGeneByIsoformId', () => {
  it('accepts valid isoform ID', async () => {
    const result = await getIsoformAndGeneByIsoformId('ENST00000000001')
    expect(result).toBeUndefined()
  })

  it('rejects empty string', async () => {
    await expect(getIsoformAndGeneByIsoformId('')).rejects.toThrow()
  })

  it('rejects ID over 100 chars', async () => {
    await expect(
      getIsoformAndGeneByIsoformId('A'.repeat(101)),
    ).rejects.toThrow()
  })
})
