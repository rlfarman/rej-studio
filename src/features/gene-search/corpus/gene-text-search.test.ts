// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vite-plus/test'
import type { GeneCorpus } from './client'
import { editDistance } from './gene-text-search'
import { sampleCorpus } from './test-utils'

/*
 * Search behaviour over the committed sample corpus (24 genes). These pin
 * what a person expects of the ranking — exact symbol first, prefixes next,
 * typos forgiven — rather than every position, so tuning MiniSearch's
 * scoring does not churn them.
 */

let corpus: GeneCorpus

beforeAll(() => {
  corpus = sampleCorpus()
})

async function symbols(query: string, species = 'both', limit = 50) {
  const page = await corpus.searchGenes(query, species, limit)
  return page.results.map((gene) => `${gene.symbol}/${gene.species}`)
}

describe('gene search (sample corpus)', () => {
  it('puts the exact symbol first, case-insensitively, then exact aliases', async () => {
    // TRP53 is the mouse gene; TP53 is one of its alternate symbols.
    expect(await symbols('tp53')).toEqual(['TP53/human', 'TRP53/mouse'])
    expect(await symbols('TP53')).toEqual(['TP53/human', 'TRP53/mouse'])
    expect(await symbols('trp53')).toEqual(['TRP53/mouse', 'TP53/human'])
  })

  it('finds a gene by an alternate symbol', async () => {
    expect(await symbols('p53')).toEqual(['TP53/human', 'TRP53/mouse'])
    expect(await symbols('her1')).toEqual(['EGFR/human'])
  })

  it('matches symbol prefixes, shortest symbol first', async () => {
    expect(await symbols('brc')).toEqual([
      'BRCA1/human',
      'BRCA1/mouse',
      'BRCA2/human',
      'BRCA2/mouse',
    ])
    expect((await symbols('cdkn')).slice(0, 2)).toEqual([
      'CDKN1A/human',
      'CDKN2A/human',
    ])
  })

  it('matches hyphenated symbols written either way', async () => {
    expect(await symbols('c-myc')).toEqual(['MYC/human'])
    expect(await symbols('nrf-2')).toEqual(['NFE2L2/human'])
    expect(await symbols('nrf2')).toEqual(['NFE2L2/human'])
  })

  it('matches name words, every word of the query', async () => {
    expect((await symbols('receptor')).sort()).toEqual([
      'AR/human',
      'EGFR/human',
      'ESR1/human',
    ])
    expect((await symbols('transcription factor')).sort()).toEqual([
      'MYC/human',
      'NFE2L2/human',
    ])
    expect(await symbols('androgen receptor')).toEqual(['AR/human'])
  })

  it('ranks a gene whose whole name is the query above other name matches', async () => {
    expect((await symbols('insulin'))[0]).toBe('INS/human')
  })

  it('forgives typos when nothing matches as typed', async () => {
    expect((await symbols('tp35'))[0]).toBe('TP53/human')
    expect((await symbols('brac1'))[0]).toBe('BRCA1/human')
    expect((await symbols('egrf'))[0]).toBe('EGFR/human')
    expect((await symbols('androgen recepter'))[0]).toBe('AR/human')
  })

  it('does not search fuzzily when the query matches as typed, or is short', async () => {
    // Literal hits only: no four-letter symbols two edits from "tp53".
    expect(await symbols('tp53')).toHaveLength(2)
    expect(await symbols('xq9')).toEqual([])
  })

  it('filters by species, typo matches included, but not for Ensembl ids', async () => {
    expect(await symbols('gapdh', 'mouse')).toEqual(['GAPDH/mouse'])
    expect(await symbols('gapdh', 'human')).toEqual(['GAPDH/human'])
    expect((await symbols('tp35', 'mouse'))[0]).toBe('TRP53/mouse')
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

    const whole = await corpus.searchGenes('brca', 'both', 4)
    expect(whole.results).toHaveLength(4)
    expect(whole.truncated).toBe(false)
  })
})

describe('similar genes ("did you mean")', () => {
  it('suggests symbols that start with the input', async () => {
    expect(await corpus.similarGenes('brca')).toEqual([
      { symbol: 'BRCA1', species: 'human' },
      { symbol: 'BRCA1', species: 'mouse' },
      { symbol: 'BRCA2', species: 'human' },
      { symbol: 'BRCA2', species: 'mouse' },
    ])
  })

  it('suggests the gene a typo meant', async () => {
    expect((await corpus.similarGenes('tp35'))[0]).toEqual({
      symbol: 'TP53',
      species: 'human',
    })
  })

  it('suggests nothing for an input like no symbol', async () => {
    expect(await corpus.similarGenes('zzzz')).toEqual([])
  })
})

describe('editDistance', () => {
  it('counts edits, with an adjacent swap as half of one', () => {
    expect(editDistance('tp53', 'tp53')).toBe(0)
    expect(editDistance('tp35', 'tp53')).toBe(0.5)
    expect(editDistance('brac1', 'brca1')).toBe(0.5)
    expect(editDistance('brac1', 'brat1')).toBe(1)
    expect(editDistance('brac1', 'rac1')).toBe(1)
    expect(editDistance('kinse', 'kinase')).toBe(1)
    expect(editDistance('', 'abc')).toBe(3)
  })
})
