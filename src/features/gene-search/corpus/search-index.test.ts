// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getTestDb } from '@/test/db'
import type { GeneCorpus } from './client'
import { sampleCorpus } from './test-utils'

/*
 * The in-browser search must order results exactly as the Postgres query
 * did. Two layers of checks:
 *
 * - Pinned orderings over the committed sample corpus. These outlive
 *   Postgres and say what the ranking is.
 * - Parity: the same queries through the real SQL (gene-queries.ts against
 *   PGlite, loaded with the same sample and the production search-vector
 *   statement) and through the corpus. Delete this half with Postgres.
 *
 * The same parity check was run once over the full corpus (39,990 genes,
 * 600 queries × search, similar-gene and symbol lookups): no differences.
 */

vi.mock('@/drizzle/db', () => ({
  getDb: async () => (await getTestDb()).db,
}))
// Force gene-queries.ts onto its Postgres branch.
vi.mock('../api/static-gene-data', () => ({ getServerCorpus: () => null }))

const { fetchGenesBySearch, fetchSimilarGenes, fetchGeneBySymbol } =
  await import('../api/gene-queries')

let corpus: GeneCorpus

beforeAll(async () => {
  corpus = sampleCorpus()
  const { db, client } = await getTestDb()
  const schema = await import('@/drizzle/schema')
  const read = (file: string) =>
    readFileSync(join(process.cwd(), 'data', file), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  await db.delete(schema.isoforms)
  await db.delete(schema.genes)
  await db.insert(schema.genes).values(read('sample-genes.jsonl'))
  await db.insert(schema.isoforms).values(read('sample-isoforms.jsonl'))
  await client.exec(
    readFileSync(
      join(process.cwd(), 'scripts/populate-search-vector.sql'),
      'utf8',
    ),
  )
})

async function symbols(query: string, species = 'both', limit = 50) {
  const page = await corpus.searchGenes(query, species, limit)
  return page.results.map((gene) => `${gene.symbol}/${gene.species}`)
}

describe('pinned orderings (sample corpus)', () => {
  it('puts the exact symbol first, then full-text rank', async () => {
    expect(await symbols('brca1')).toEqual(['BRCA1/human', 'BRCA1/mouse'])
  })

  it('ranks prefix matches by name when full-text rank ties', async () => {
    expect(await symbols('brca')).toEqual([
      'BRCA1/human',
      'BRCA2/human',
      'BRCA1/mouse',
      'BRCA2/mouse',
    ])
  })

  it('ranks a name word by full-text rank, then name', async () => {
    expect(await symbols('receptor')).toEqual([
      'AR/human',
      'EGFR/human',
      'ESR1/human',
    ])
  })

  it('ranks multi-word queries by proximity, ties by name', async () => {
    // Both names hold the two words side by side, so they tie on rank.
    expect(await symbols('transcription factor')).toEqual([
      'MYC/human',
      'NFE2L2/human',
    ])
    expect(await symbols('dna associated')).toEqual([
      'BRCA1/human',
      'BRCA2/human',
    ])
  })

  it('matches aliases and substrings', async () => {
    expect(await symbols('p53')).toEqual(['TP53/human', 'TRP53/mouse'])
  })

  it('filters by species, but not for Ensembl ids', async () => {
    expect(await symbols('gapdh', 'mouse')).toEqual(['GAPDH/mouse'])
    expect(await symbols('ENSG00000141510', 'mouse')).toEqual(['TP53/human'])
  })

  it('finds a gene by transcript id and says which', async () => {
    const page = await corpus.searchGenes('ENST00000352993', 'both', 6)
    expect(page.results).toEqual([
      expect.objectContaining({
        symbol: 'BRCA1',
        matchedIsoformId: 'ENST00000352993',
      }),
    ])
    expect(await symbols('ENST99999999999')).toEqual([])
  })

  it('cuts at the limit and says so', async () => {
    const page = await corpus.searchGenes('a', 'both', 3)
    expect(page.results).toHaveLength(3)
    expect(page.truncated).toBe(true)
  })

  it('suggests similar symbols: prefix, then substring, then first three', async () => {
    expect(await corpus.similarGenes('brca')).toEqual([
      { symbol: 'BRCA1', species: 'human' },
      { symbol: 'BRCA1', species: 'mouse' },
      { symbol: 'BRCA2', species: 'human' },
      { symbol: 'BRCA2', species: 'mouse' },
    ])
  })
})

const PARITY_QUERIES = [
  'a',
  'r',
  '1',
  'brca',
  'BRCA1',
  'brca1 dna',
  'dna repair',
  'p53',
  'tp53',
  'protein',
  'proto-oncogene',
  'receptor',
  'kinase inhibitor',
  'cyclin dependent',
  'transcription factor',
  'oncogene',
  'early onset',
  'glyceraldehyde-3-phosphate',
  'subtilisin/kexin',
  'insulin',
  'ins',
  'myc',
  'nf',
  'cdkn',
  'beta',
  '%',
  '_',
  'zzz',
]

describe('parity with the Postgres query (sample corpus)', () => {
  it.each(
    PARITY_QUERIES.flatMap(
      (q) =>
        [
          [q, 'both', 6],
          [q, 'human', 50],
          [q, 'mouse', 3],
        ] as const,
    ),
  )('search %s / %s / %i', async (q, species, limit) => {
    expect(await corpus.searchGenes(q, species, limit)).toEqual(
      await fetchGenesBySearch(q, species, limit),
    )
  })

  it.each(PARITY_QUERIES.map((q) => q.toLowerCase()))(
    'similar genes %s',
    async (q) => {
      expect(await corpus.similarGenes(q)).toEqual(await fetchSimilarGenes(q))
    },
  )

  it.each([
    ['TP53', undefined],
    ['brca1', undefined],
    ['BRCA1', 'mouse'],
    ['Brca1', 'both'],
    ['gapdh', 'human'],
    ['nope', undefined],
  ] as const)('gene by symbol %s / %s', async (symbol, species) => {
    const index = await corpus.loadIndex()
    expect(index.geneBySymbol(symbol, species)).toEqual(
      await fetchGeneBySymbol(symbol, species),
    )
  })
})
