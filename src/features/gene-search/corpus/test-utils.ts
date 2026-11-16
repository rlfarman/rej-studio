import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GeneCorpus } from './client'

export const SAMPLE_CORPUS_DIR = join(
  process.cwd(),
  'public',
  'gene-data',
  'sample',
)

/** The committed sample corpus, read from disk (tests only). */
export function sampleCorpus(): GeneCorpus {
  return new GeneCorpus(async (path) => {
    try {
      return JSON.parse(readFileSync(join(SAMPLE_CORPUS_DIR, path), 'utf8'))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  })
}
