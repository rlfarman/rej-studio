// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCorpus, type SeedIsoform } from './build'
import type { CorpusGene, GeneIndexFile } from './format'
import { SAMPLE_CORPUS_DIR } from './test-utils'

function readJsonl<T>(file: string): T[] {
  return readFileSync(join(process.cwd(), 'data', file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort()
}

const gene = (id: string, symbol: string): CorpusGene => ({
  id,
  symbol,
  name: `${symbol} name`,
  species: 'human',
  alternateSymbols: '',
})
const isoform = (id: string, geneId: string): SeedIsoform => ({
  id,
  geneId,
  codingSequenceLength: 3,
  proteinSequenceLength: 1,
  codingSequence: 'ATG',
  proteinSequence: 'M',
  species: 'human',
})

describe('buildCorpus', () => {
  it('reproduces the committed sample byte for byte', () => {
    const built = buildCorpus(
      readJsonl('sample-genes.jsonl'),
      readJsonl('sample-isoforms.jsonl'),
      'sample',
    )
    // If this fails, the format or the seed changed: run `pnpm corpus:build
    // --force` and commit public/gene-data/sample.
    expect(listFiles(SAMPLE_CORPUS_DIR)).toEqual([...built.files.keys()].sort())
    for (const [path, contents] of built.files) {
      expect(readFileSync(join(SAMPLE_CORPUS_DIR, path), 'utf8')).toBe(contents)
    }
  })

  it('drops genes without an id and isoforms without a gene', () => {
    const built = buildCorpus(
      [gene('ENSG2', 'B'), gene('', ''), gene('ENSG1', 'A')],
      [
        isoform('ENST2', 'ENSG1'),
        isoform('ENST1', 'ENSG1'),
        isoform('ENST3', ''),
      ],
      'test',
    )
    expect(built).toMatchObject({
      geneCount: 2,
      isoformCount: 2,
      skippedGenes: 1,
      orphanIsoforms: 1,
    })
    const index = JSON.parse(built.files.get('index.json')!) as GeneIndexFile
    expect(index.genes.id).toEqual(['ENSG1', 'ENSG2'])
    const file = JSON.parse(built.files.get('genes/ENSG1.json')!)
    expect(file.isoforms.map((i: { id: string }) => i.id)).toEqual([
      'ENST1',
      'ENST2',
    ])
    expect(JSON.parse(built.files.get('transcripts/0.json')!)).toEqual({
      ENST1: 'ENSG1',
      ENST2: 'ENSG1',
    })
    expect(built.files.has('symbols/a.json')).toBe(true)
  })

  it('refuses ids that would not make a safe file name', () => {
    expect(() => buildCorpus([gene('../x', 'X')], [], 'test')).toThrow(
      /not file-safe/,
    )
  })
})
