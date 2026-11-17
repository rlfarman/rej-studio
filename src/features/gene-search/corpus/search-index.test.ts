// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vite-plus/test'
import type { GeneCorpus } from './client'
import { sampleCorpus } from './test-utils'

/*
 * The in-browser search orders results exactly as the Postgres query it
 * replaced did. These orderings over the committed sample corpus pin that
 * ranking down.
 *
 * Until Postgres was deleted, the same queries also ran through the real SQL
 * (against PGlite, loaded with this sample) and the two agreed. One run over
 * the full corpus (39,990 genes, 600 queries × search, similar-gene and
 * symbol lookups) found no differences either.
 */

let corpus: GeneCorpus

beforeAll(() => {
  corpus = sampleCorpus()
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
