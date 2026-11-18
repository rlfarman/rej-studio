// @vitest-environment node
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import {
  MAX_IDENTITY_ISOFORMS,
  parseIsoformIdentity,
  selectIdentityIsoforms,
  triangleSize,
} from './identity'
import { SAMPLE_CORPUS_DIR, sampleCorpus } from './test-utils'

const iso = (id: string, proteinSequenceLength: number) => ({
  id,
  proteinSequenceLength,
})

describe('selectIdentityIsoforms', () => {
  it('puts the longest protein first and breaks ties by transcript id', () => {
    const picked = selectIdentityIsoforms([
      iso('ENST3', 100),
      iso('ENST2', 300),
      iso('ENST9', 200),
      iso('ENST1', 200),
    ])
    expect(picked.map(({ id }) => id)).toEqual([
      'ENST2',
      'ENST1',
      'ENST9',
      'ENST3',
    ])
  })

  it('does not depend on input order', () => {
    const isoforms = Array.from({ length: 30 }, (_, i) =>
      iso(`ENST${String(i).padStart(2, '0')}`, 100 + (i % 4)),
    )
    const forward = selectIdentityIsoforms(isoforms)
    expect(selectIdentityIsoforms([...isoforms].reverse())).toEqual(forward)
  })

  it(`keeps at most ${MAX_IDENTITY_ISOFORMS}, the longest`, () => {
    const isoforms = Array.from({ length: 20 }, (_, i) => iso(`ENST${i}`, i))
    const picked = selectIdentityIsoforms(isoforms)
    expect(picked).toHaveLength(MAX_IDENTITY_ISOFORMS)
    expect(picked.at(-1)?.proteinSequenceLength).toBe(4)
  })

  it('does not reorder its input', () => {
    const isoforms = [iso('ENST1', 1), iso('ENST2', 2)]
    selectIdentityIsoforms(isoforms)
    expect(isoforms.map(({ id }) => id)).toEqual(['ENST1', 'ENST2'])
  })
})

describe('parseIsoformIdentity', () => {
  const isoforms = [iso('ENST1', 50), iso('ENST2', 300), iso('ENST3', 100)]
  // Display order: ENST2, ENST3, ENST1.
  const stored = {
    isoforms: ['ENST2', 'ENST3', 'ENST1'],
    permille: [642, 125, 1000],
  }

  it('expands the triangle into a symmetric matrix of percentages', () => {
    expect(parseIsoformIdentity(stored, isoforms)).toEqual({
      ids: ['ENST2', 'ENST3', 'ENST1'],
      percent: [
        [100, 64.2, 12.5],
        [64.2, 100, 100],
        [12.5, 100, 100],
      ],
    })
  })

  it('is null when the gene file has none (an older corpus)', () => {
    expect(parseIsoformIdentity(undefined, isoforms)).toBeNull()
  })

  it.each([
    ['not an object', 'nope'],
    ['missing ids', { permille: stored.permille }],
    ['missing values', { isoforms: stored.isoforms }],
    ['a different order', { ...stored, isoforms: ['ENST2', 'ENST1', 'ENST3'] }],
    ['a different isoform', { ...stored, isoforms: ['ENST2', 'ENST3', 'X'] }],
    ['too few values', { ...stored, permille: [642, 125] }],
    ['a fraction', { ...stored, permille: [642, 125.5, 1000] }],
    ['a value over 1000', { ...stored, permille: [642, 125, 1001] }],
    ['a negative value', { ...stored, permille: [642, -1, 1000] }],
    ['a string', { ...stored, permille: [642, '125', 1000] }],
  ])('is null for %s', (_, value) => {
    expect(parseIsoformIdentity(value, isoforms)).toBeNull()
  })

  it('accepts every gene in the committed sample', async () => {
    const corpus = sampleCorpus()
    const dir = join(SAMPLE_CORPUS_DIR, 'genes')
    for (const name of readdirSync(dir)) {
      const file = (await corpus.geneFile(name.replace(/\.json$/, '')))!
      const parsed = parseIsoformIdentity(file.isoformIdentity, file.isoforms)
      expect({ gene: file.symbol, parsed: parsed !== null }).toEqual({
        gene: file.symbol,
        parsed: true,
      })
    }
  })

  it('reads TP53 as the build stored it', async () => {
    const corpus = sampleCorpus()
    const tp53 = (await corpus.loadIndex()).geneBySymbol('TP53', 'human')!
    const file = (await corpus.geneFile(tp53.id))!
    const matrix = parseIsoformIdentity(file.isoformIdentity, file.isoforms)!
    expect(matrix.ids).toHaveLength(MAX_IDENTITY_ISOFORMS)
    expect(matrix.ids.slice(0, 2)).toEqual([
      'ENST00000635293',
      'ENST00000269305',
    ])
    expect(matrix.percent[0][1]).toBe(74.4)
  })
})

describe('triangleSize', () => {
  it('counts the pairs above the diagonal', () => {
    expect([0, 1, 2, 3, 16].map(triangleSize)).toEqual([0, 0, 1, 3, 120])
  })
})
