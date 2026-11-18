// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

import { GeneCorpus } from './client'
import { SAMPLE_CORPUS_DIR } from './test-utils'

/** The sample corpus, recording every file read; `hide` reads as missing. */
function recordingCorpus(hide: string[] = []) {
  const reads: string[] = []
  const corpus = new GeneCorpus(async (path) => {
    reads.push(path)
    if (hide.includes(path)) return null
    try {
      return JSON.parse(readFileSync(join(SAMPLE_CORPUS_DIR, path), 'utf8'))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  })
  return { corpus, reads }
}

describe('lookups that should not wait for the whole index', () => {
  it('finds a gene by symbol from its symbol shard alone', async () => {
    const { corpus, reads } = recordingCorpus()
    const gene = await corpus.geneBySymbol('tp53', 'human')
    expect(gene).toMatchObject({ id: 'ENSG00000141510', symbol: 'TP53' })
    expect(reads).toEqual(['symbols/tp.json'])
  })

  it('answers null for a symbol with no shard', async () => {
    const { corpus } = recordingCorpus()
    expect(await corpus.geneBySymbol('zz-not-a-gene', undefined)).toBeNull()
    expect(await corpus.geneBySymbol('  ', undefined)).toBeNull()
  })

  it('finds a transcript’s gene from the manifest and one shard', async () => {
    const { corpus, reads } = recordingCorpus()
    expect(await corpus.geneIdOfTranscript('ENST00000269305')).toBe(
      'ENSG00000141510',
    )
    expect(reads).toHaveLength(2)
    expect(reads[0]).toBe('manifest.json')
    expect(reads[1]).toMatch(/^transcripts\/\d+\.json$/)
  })

  it('falls back to the index for a corpus built before the manifest', async () => {
    const { corpus, reads } = recordingCorpus(['manifest.json'])
    expect(await corpus.geneIdOfTranscript('ENST00000269305')).toBe(
      'ENSG00000141510',
    )
    expect(reads).toContain('index.json')
  })
})

describe('Ensembl id searches', () => {
  it('finds a gene by its uppercase gene ID', async () => {
    const { corpus } = recordingCorpus()
    const { results } = await corpus.searchGenes('ENSG00000141510', 'both', 6)
    expect(results.map((g) => g.symbol)).toEqual(['TP53'])
  })

  it('finds a gene by a lowercase gene ID', async () => {
    const { corpus } = recordingCorpus()
    const { results } = await corpus.searchGenes('ensg00000141510', 'both', 6)
    expect(results.map((g) => g.symbol)).toEqual(['TP53'])
  })

  it('finds a transcript by a versioned ID, and reports it unversioned', async () => {
    const { corpus } = recordingCorpus()
    const { results } = await corpus.searchGenes('ENST00000269305.9', 'both', 6)
    expect(results).toMatchObject([
      { symbol: 'TP53', matchedIsoformId: 'ENST00000269305' },
    ])
  })

  it('finds a transcript by a lowercase ID', async () => {
    const { corpus } = recordingCorpus()
    const { results } = await corpus.searchGenes('enst00000269305', 'both', 6)
    expect(results).toMatchObject([
      { symbol: 'TP53', matchedIsoformId: 'ENST00000269305' },
    ])
  })
})
