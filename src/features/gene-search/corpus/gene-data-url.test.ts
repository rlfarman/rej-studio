import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { GeneIndexFile } from './format'
import {
  SAMPLE_GENE_COUNT,
  geneDataUrl,
  usesSampleCorpus,
} from './gene-data-url'
import { SAMPLE_CORPUS_DIR } from './test-utils'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('geneDataUrl', () => {
  it('reads the committed sample when nothing is configured', () => {
    vi.stubEnv('VITE_GENE_DATA_URL', '')
    expect(geneDataUrl()).toBe('/gene-data/sample')
    expect(usesSampleCorpus()).toBe(true)
  })

  it('reads the configured corpus, without a trailing slash', () => {
    vi.stubEnv('VITE_GENE_DATA_URL', 'https://genes.example.org/v1/')
    expect(geneDataUrl()).toBe('https://genes.example.org/v1')
    expect(usesSampleCorpus()).toBe(false)
  })
})

describe('SAMPLE_GENE_COUNT', () => {
  it('is how many genes the committed sample holds', () => {
    const index = JSON.parse(
      readFileSync(join(SAMPLE_CORPUS_DIR, 'index.json'), 'utf8'),
    ) as GeneIndexFile
    expect(index.geneCount).toBe(SAMPLE_GENE_COUNT)
  })
})
