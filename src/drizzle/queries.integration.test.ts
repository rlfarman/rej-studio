/**
 * Database integration tests — real SQL queries against in-memory PGlite.
 *
 * These test the LIKE-based fallback paths and Ensembl ID exact-match paths.
 * FTS (tsvector/GIN) requires `search_vector` to be populated, which needs
 * a trigger or manual update — we test the LIKE fallback that fires when
 * search_vector is null. The trigram indexes from migration 0001 are covered
 * by migrations.integration.test.ts; the queries don't depend on them.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanDb, getTestDb, seedGenes, seedIsoforms } from '@/test/db'
import { makeGene, makeIsoform, resetFixtureCounters } from '@/test/fixtures'

// Redirect getDb() to our test PGlite instance
let testDb: Awaited<ReturnType<typeof getTestDb>>

vi.mock('@/drizzle/db', () => ({
  getDb: async () => (await getTestDb()).db,
}))

// Import queries AFTER the mock is set up
const {
  fetchGenesBySearch,
  fetchGeneBySymbol,
  fetchSimilarGenes,
  fetchAllGeneSymbols,
} = await import('@/features/gene-search/api/gene-queries')
const {
  fetchIsoformsByGene,
  fetchIsoformSummaryByGene,
  fetchIsoformAndGeneByIsoformId,
} = await import('@/features/gene-search/api/isoform-queries')

beforeAll(async () => {
  testDb = await getTestDb()
})

afterEach(async () => {
  await cleanDb(testDb.db)
  resetFixtureCounters()
})

// ---------------------------------------------------------------------------
// fetchGenesBySearch
// ---------------------------------------------------------------------------
describe('fetchGenesBySearch', () => {
  async function search(query: string, species = 'both', limit = 6) {
    return (await fetchGenesBySearch(query, species, limit)).results
  }

  it('finds gene by exact symbol via LIKE', async () => {
    await seedGenes(testDb.db, [
      makeGene({ symbol: 'BRCA1', species: 'human' }),
    ])
    const results = await search('BRCA1')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].symbol).toBe('BRCA1')
  })

  it('finds gene by prefix via LIKE', async () => {
    await seedGenes(testDb.db, [
      makeGene({ symbol: 'BRCA1', species: 'human' }),
    ])
    const results = await search('BRC')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].symbol).toBe('BRCA1')
  })

  it('finds gene by name substring via LIKE', async () => {
    await seedGenes(testDb.db, [
      makeGene({ symbol: 'BRCA1', name: 'BRCA1 DNA Repair', species: 'human' }),
    ])
    const results = await search('DNA Repair')
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('finds gene by alias', async () => {
    await seedGenes(testDb.db, [
      makeGene({ symbol: 'TP53', alternateSymbols: '|LFS1|P53|' }),
    ])
    const results = await search('lfs1')
    expect(results.map((r) => r.symbol)).toEqual(['TP53'])
  })

  it('ranks an exact symbol match first', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'MYCN', name: 'MYCN proto-oncogene' }),
      makeGene({ id: 'g2', symbol: 'MYC', name: 'MYC proto-oncogene' }),
      makeGene({ id: 'g3', symbol: 'AMY1', name: 'amylase alpha 1A' }),
    ])
    const results = await search('myc')
    expect(results[0].symbol).toBe('MYC')
  })

  it('treats % and _ in the query as literal characters', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'ABC1', name: 'first' }),
      makeGene({ id: 'g2', symbol: 'ABC2', name: 'second' }),
      makeGene({ id: 'g3', symbol: 'A_C3', name: 'third' }),
    ])
    expect(await search('%')).toEqual([])
    expect(await search('a%c')).toEqual([])
    // Unescaped, `_` would match any character and return all three.
    expect((await search('a_c')).map((r) => r.symbol)).toEqual(['A_C3'])
  })

  it('filters by species=human', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'TP53', species: 'human' }),
      makeGene({ id: 'g2', symbol: 'Trp53', species: 'mouse' }),
    ])
    const results = await search('53', 'human')
    expect(results.every((r) => r.species === 'human')).toBe(true)
  })

  it('species=both returns all', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'TP53', species: 'human' }),
      makeGene({ id: 'g2', symbol: 'Trp53', species: 'mouse' }),
    ])
    const results = await search('53')
    expect(results.length).toBe(2)
  })

  it('finds gene by Ensembl gene ID (ENSG)', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'ENSG00000141510', symbol: 'TP53', species: 'human' }),
    ])
    const results = await search('ENSG00000141510')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('ENSG00000141510')
  })

  it('finds gene by Ensembl transcript ID (ENST) via isoform join', async () => {
    const gene = makeGene({ id: 'ENSG001', symbol: 'BRCA1', species: 'human' })
    const isoform = makeIsoform({ id: 'ENST00000012345', geneId: 'ENSG001' })
    await seedGenes(testDb.db, [gene])
    await seedIsoforms(testDb.db, [isoform])
    const results = await search('ENST00000012345')
    expect(results).toHaveLength(1)
    expect(results[0].symbol).toBe('BRCA1')
    expect(results[0].matchedIsoformId).toBe('ENST00000012345')
  })

  it('returns empty for nonsense query', async () => {
    await seedGenes(testDb.db, [makeGene({ symbol: 'BRCA1' })])
    const results = await search('ZZZZZZZZZZZ')
    expect(results).toEqual([])
  })

  it('caps results at the limit and reports truncation', async () => {
    const genes = Array.from({ length: 8 }, (_, i) =>
      makeGene({ id: `g${i}`, symbol: `GENE${i}`, name: `Test Gene ${i}` }),
    )
    await seedGenes(testDb.db, genes)

    const palette = await fetchGenesBySearch('GENE', 'both', 6)
    expect(palette.results).toHaveLength(6)
    expect(palette.truncated).toBe(true)

    const page = await fetchGenesBySearch('GENE', 'both', 50)
    expect(page.results).toHaveLength(8)
    expect(page.truncated).toBe(false)
  })

  it("doesn't report truncation when the results fit exactly", async () => {
    const genes = Array.from({ length: 6 }, (_, i) =>
      makeGene({ id: `g${i}`, symbol: `GENE${i}` }),
    )
    await seedGenes(testDb.db, genes)
    const page = await fetchGenesBySearch('GENE', 'both', 6)
    expect(page.results).toHaveLength(6)
    expect(page.truncated).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// fetchGeneBySymbol
// ---------------------------------------------------------------------------
describe('fetchGeneBySymbol', () => {
  it('returns gene for exact symbol', async () => {
    await seedGenes(testDb.db, [makeGene({ symbol: 'TP53', species: 'human' })])
    const result = await fetchGeneBySymbol('TP53', undefined)
    expect(result).not.toBeNull()
    expect(result!.symbol).toBe('TP53')
  })

  it('matches case-insensitively and returns the canonical casing', async () => {
    await seedGenes(testDb.db, [makeGene({ symbol: 'TP53', species: 'human' })])
    const result = await fetchGeneBySymbol('tp53', undefined)
    expect(result!.symbol).toBe('TP53')
  })

  it('prefers the exact casing, then human, when casing is ambiguous', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'Brca1', species: 'mouse' }),
      makeGene({ id: 'g2', symbol: 'BRCA1', species: 'human' }),
    ])
    expect((await fetchGeneBySymbol('Brca1', undefined))!.species).toBe('mouse')
    expect((await fetchGeneBySymbol('BRCA1', undefined))!.species).toBe('human')
    expect((await fetchGeneBySymbol('brca1', undefined))!.species).toBe('human')
  })

  it('filters by species', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'TP53', species: 'human' }),
      makeGene({ id: 'g2', symbol: 'TP53', species: 'mouse' }),
    ])
    const result = await fetchGeneBySymbol('tp53', 'mouse')
    expect(result!.species).toBe('mouse')
  })

  it('returns null for non-existent', async () => {
    const result = await fetchGeneBySymbol('NONEXISTENT', undefined)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// fetchSimilarGenes
// ---------------------------------------------------------------------------
describe('fetchSimilarGenes', () => {
  it('returns prefix matches', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'BRCA1' }),
      makeGene({ id: 'g2', symbol: 'BRCA2' }),
      makeGene({ id: 'g3', symbol: 'TP53' }),
    ])
    const results = await fetchSimilarGenes('brca')
    expect(results.length).toBe(2)
    expect(results.every((r) => r.symbol.startsWith('BRCA'))).toBe(true)
  })

  it('treats wildcards in the input literally', async () => {
    await seedGenes(testDb.db, [makeGene({ id: 'g1', symbol: 'BRCA1' })])
    expect(await fetchSimilarGenes('%')).toEqual([])
    expect(await fetchSimilarGenes('_')).toEqual([])
  })

  it('caps at 5 results', async () => {
    const genes = Array.from({ length: 7 }, (_, i) =>
      makeGene({ id: `g${i}`, symbol: `ABC${i}` }),
    )
    await seedGenes(testDb.db, genes)
    const results = await fetchSimilarGenes('abc')
    expect(results.length).toBeLessThanOrEqual(5)
  })
})

// ---------------------------------------------------------------------------
// fetchIsoformsByGene
// ---------------------------------------------------------------------------
describe('fetchIsoformsByGene', () => {
  it('returns all isoforms for a gene ordered by ID', async () => {
    const gene = makeGene({ id: 'ENSG001' })
    await seedGenes(testDb.db, [gene])
    await seedIsoforms(testDb.db, [
      makeIsoform({ id: 'ENST003', geneId: 'ENSG001' }),
      makeIsoform({ id: 'ENST001', geneId: 'ENSG001' }),
      makeIsoform({ id: 'ENST002', geneId: 'ENSG001' }),
    ])
    const results = await fetchIsoformsByGene('ENSG001')
    expect(results).toHaveLength(3)
    expect(results[0].id).toBe('ENST001')
    expect(results[1].id).toBe('ENST002')
    expect(results[2].id).toBe('ENST003')
  })

  it('returns empty for non-existent gene', async () => {
    const results = await fetchIsoformsByGene('NONEXISTENT')
    expect(results).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// fetchIsoformAndGeneByIsoformId
// ---------------------------------------------------------------------------
describe('fetchIsoformAndGeneByIsoformId', () => {
  it('returns joined isoform + gene', async () => {
    const gene = makeGene({ id: 'ENSG001', symbol: 'BRCA1' })
    const isoform = makeIsoform({ id: 'ENST001', geneId: 'ENSG001' })
    await seedGenes(testDb.db, [gene])
    await seedIsoforms(testDb.db, [isoform])
    const result = await fetchIsoformAndGeneByIsoformId('ENST001')
    expect(result).toBeDefined()
    expect(result!.isoform.id).toBe('ENST001')
    expect(result!.gene.symbol).toBe('BRCA1')
  })

  it('returns undefined for non-existent', async () => {
    const result = await fetchIsoformAndGeneByIsoformId('NONEXISTENT')
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// fetchIsoformSummaryByGene
// ---------------------------------------------------------------------------
describe('fetchIsoformSummaryByGene', () => {
  it('counts isoforms and lists species without loading sequences', async () => {
    await seedGenes(testDb.db, [makeGene({ id: 'ENSG001' })])
    await seedIsoforms(testDb.db, [
      makeIsoform({ id: 'ENST001', geneId: 'ENSG001', species: 'mouse' }),
      makeIsoform({ id: 'ENST002', geneId: 'ENSG001', species: 'human' }),
      makeIsoform({ id: 'ENST003', geneId: 'ENSG001', species: 'human' }),
    ])
    const summary = await fetchIsoformSummaryByGene('ENSG001')
    expect(summary).toEqual({ isoformCount: 3, species: ['human', 'mouse'] })
  })

  it('returns zero for a gene without isoforms', async () => {
    const summary = await fetchIsoformSummaryByGene('NONEXISTENT')
    expect(summary).toEqual({ isoformCount: 0, species: [] })
  })
})

// ---------------------------------------------------------------------------
// fetchAllGeneSymbols
// ---------------------------------------------------------------------------
describe('fetchAllGeneSymbols', () => {
  it('returns every gene symbol with its species', async () => {
    await seedGenes(testDb.db, [
      makeGene({ symbol: 'BRCA1', species: 'human' }),
      makeGene({ symbol: 'Brca1', species: 'mouse' }),
    ])
    const rows = await fetchAllGeneSymbols()
    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        { symbol: 'BRCA1', species: 'human' },
        { symbol: 'Brca1', species: 'mouse' },
      ]),
    )
  })
})
