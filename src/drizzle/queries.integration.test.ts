/**
 * Database integration tests — real SQL queries against in-memory PGlite.
 *
 * These test the LIKE-based fallback paths and Ensembl ID exact-match paths.
 * FTS (tsvector/GIN) requires `search_vector` to be populated, which needs
 * a trigger or manual update — we test the LIKE fallback that fires when
 * search_vector is null.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { cleanDb, getTestDb, seedGenes, seedIsoforms } from '@/test/db'
import { makeGene, makeIsoform, resetFixtureCounters } from '@/test/fixtures'

// Redirect getDb() to our test PGlite instance
let testDb: Awaited<ReturnType<typeof getTestDb>>

vi.mock('@/drizzle/db', () => ({
  getDb: async () => (await getTestDb()).db,
}))

// Import queries AFTER the mock is set up
const { fetchGenesBySearch, fetchGeneBySymbol, fetchSimilarGenes } =
  await import('@/features/gene-search/api/gene-queries')
const { fetchIsoformsByGene, fetchIsoformAndGeneByIsoformId } =
  await import('@/features/gene-search/api/isoform-queries')

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
  it('finds gene by exact symbol via LIKE', async () => {
    await seedGenes(testDb.db, [
      makeGene({ symbol: 'BRCA1', species: 'human' }),
    ])
    const results = await fetchGenesBySearch('BRCA1', 'both')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].symbol).toBe('BRCA1')
  })

  it('finds gene by prefix via LIKE', async () => {
    await seedGenes(testDb.db, [
      makeGene({ symbol: 'BRCA1', species: 'human' }),
    ])
    const results = await fetchGenesBySearch('BRC', 'both')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].symbol).toBe('BRCA1')
  })

  it('finds gene by name substring via LIKE', async () => {
    await seedGenes(testDb.db, [
      makeGene({ symbol: 'BRCA1', name: 'BRCA1 DNA Repair', species: 'human' }),
    ])
    const results = await fetchGenesBySearch('DNA Repair', 'both')
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('filters by species=human', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'TP53', species: 'human' }),
      makeGene({ id: 'g2', symbol: 'Trp53', species: 'mouse' }),
    ])
    const results = await fetchGenesBySearch('53', 'human')
    expect(results.every((r) => r.species === 'human')).toBe(true)
  })

  it('species=both returns all', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'TP53', species: 'human' }),
      makeGene({ id: 'g2', symbol: 'Trp53', species: 'mouse' }),
    ])
    const results = await fetchGenesBySearch('53', 'both')
    expect(results.length).toBe(2)
  })

  it('finds gene by Ensembl gene ID (ENSG)', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'ENSG00000141510', symbol: 'TP53', species: 'human' }),
    ])
    const results = await fetchGenesBySearch('ENSG00000141510', 'both')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('ENSG00000141510')
  })

  it('finds gene by Ensembl transcript ID (ENST) via isoform join', async () => {
    const gene = makeGene({ id: 'ENSG001', symbol: 'BRCA1', species: 'human' })
    const isoform = makeIsoform({ id: 'ENST00000012345', geneId: 'ENSG001' })
    await seedGenes(testDb.db, [gene])
    await seedIsoforms(testDb.db, [isoform])
    const results = await fetchGenesBySearch('ENST00000012345', 'both')
    expect(results).toHaveLength(1)
    expect(results[0].symbol).toBe('BRCA1')
    expect(results[0].matchedIsoformId).toBe('ENST00000012345')
  })

  it('returns empty for nonsense query', async () => {
    await seedGenes(testDb.db, [makeGene({ symbol: 'BRCA1' })])
    const results = await fetchGenesBySearch('ZZZZZZZZZZZ', 'both')
    expect(results).toEqual([])
  })

  it('caps at 6 results', async () => {
    const genes = Array.from({ length: 8 }, (_, i) =>
      makeGene({ id: `g${i}`, symbol: `GENE${i}`, name: `Test Gene ${i}` }),
    )
    await seedGenes(testDb.db, genes)
    const results = await fetchGenesBySearch('GENE', 'both')
    expect(results.length).toBeLessThanOrEqual(6)
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

  it('filters by species', async () => {
    await seedGenes(testDb.db, [
      makeGene({ id: 'g1', symbol: 'TP53', species: 'human' }),
      makeGene({ id: 'g2', symbol: 'TP53', species: 'mouse' }),
    ])
    const result = await fetchGeneBySymbol('TP53', 'mouse')
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
    const results = await fetchSimilarGenes('BRCA')
    expect(results.length).toBe(2)
    expect(results.every((r) => r.symbol.startsWith('BRCA'))).toBe(true)
  })

  it('caps at 5 results', async () => {
    const genes = Array.from({ length: 7 }, (_, i) =>
      makeGene({ id: `g${i}`, symbol: `ABC${i}` }),
    )
    await seedGenes(testDb.db, genes)
    const results = await fetchSimilarGenes('ABC')
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
