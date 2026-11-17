// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { buildCorpus, identityInputs, type SeedIsoform } from './build'
import type { CorpusGene, GeneFile, GeneIndexFile } from './format'
import { SAMPLE_CORPUS_DIR } from './test-utils'

/**
 * The identities the committed sample stores, keyed by gene id. The values
 * come from Rust (rust/optimizer/tests/align.rs checks them against the
 * aligner), so feeding them back lets this test check everything else the
 * build writes, including which isoforms they are for, without cargo.
 */
function storedIdentities(): Map<string, number[]> {
  const dir = join(SAMPLE_CORPUS_DIR, 'genes')
  return new Map(
    readdirSync(dir).map((name) => {
      const file = JSON.parse(readFileSync(join(dir, name), 'utf8')) as GeneFile
      return [file.id, file.isoformIdentity?.permille ?? []]
    }),
  )
}

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
const isoform = (
  id: string,
  geneId: string,
  proteinSequence = 'M',
): SeedIsoform => ({
  id,
  geneId,
  codingSequenceLength: proteinSequence.length * 3,
  proteinSequenceLength: proteinSequence.length,
  codingSequence: 'ATG'.repeat(proteinSequence.length),
  proteinSequence,
  species: 'human',
})

describe('buildCorpus', () => {
  it('reproduces the committed sample byte for byte', () => {
    const built = buildCorpus(
      readJsonl('sample-genes.jsonl'),
      readJsonl('sample-isoforms.jsonl'),
      'sample',
      storedIdentities(),
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
      new Map([['ENSG1', [1000]]]),
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
    expect(() =>
      buildCorpus([gene('../x', 'X')], [], 'test', new Map()),
    ).toThrow(/not file-safe/)
  })

  it('stores identities for the selected isoforms, longest first', () => {
    const isoforms = [
      isoform('ENST1', 'ENSG1', 'MA'),
      isoform('ENST2', 'ENSG1', 'MAAA'),
      isoform('ENST3', 'ENSG1', 'MAA'),
      isoform('ENST4', 'ENSG2'),
    ]
    // What the build sends to Rust: proteins in display order.
    expect(identityInputs(isoforms)).toEqual(
      new Map([['ENSG1', ['MAAA', 'MAA', 'MA']]]),
    )
    const built = buildCorpus(
      [gene('ENSG1', 'A'), gene('ENSG2', 'B')],
      isoforms,
      'test',
      new Map([['ENSG1', [750, 500, 667]]]),
    )
    const file = (id: string) =>
      JSON.parse(built.files.get(`genes/${id}.json`)!) as GeneFile
    expect(file('ENSG1').isoformIdentity).toEqual({
      isoforms: ['ENST2', 'ENST3', 'ENST1'],
      permille: [750, 500, 667],
    })
    // One isoform: stored anyway, so absence only ever means an old corpus.
    expect(file('ENSG2').isoformIdentity).toEqual({
      isoforms: ['ENST4'],
      permille: [],
    })
  })

  it('refuses identities that do not fit the selected isoforms', () => {
    const build = (identities: Map<string, number[]>) => () =>
      buildCorpus(
        [gene('ENSG1', 'A')],
        [isoform('ENST1', 'ENSG1'), isoform('ENST2', 'ENSG1')],
        'test',
        identities,
      )
    expect(build(new Map())).toThrow(/0 identities for 2 isoforms/)
    expect(build(new Map([['ENSG1', [1, 2]]]))).toThrow(/expected 1/)
  })
})
