import 'server-only'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GeneCorpus, type CorpusReader } from '../corpus/client'
import { INDEX_PATH } from '../corpus/format'
import { geneDataUrl, httpReader } from '../corpus/gene-data-url'

const isAbsolute = (baseUrl: string) => /^https?:\/\//.test(baseUrl)

const publicDir = (baseUrl: string) =>
  join(process.cwd(), 'public', ...baseUrl.split('/'))

/**
 * A root-relative base URL (`/gene-data/sample`) names files the app serves
 * from public/. The server reads those straight off disk: fetching its own
 * origin would need an absolute URL and would hit the session gate.
 */
function publicDirReader(baseUrl: string): CorpusReader {
  const root = publicDir(baseUrl)
  return async (path) => {
    try {
      return JSON.parse(await readFile(join(root, ...path.split('/')), 'utf8'))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }
}

let serverCorpus: GeneCorpus | null | undefined

/**
 * The server's handle on the static corpus, or null when genes come from
 * Postgres (see geneDataUrl). The index stays in memory for the life of
 * the server instance.
 */
export function getServerCorpus(): GeneCorpus | null {
  if (serverCorpus !== undefined) return serverCorpus
  const baseUrl = geneDataUrl()
  serverCorpus = baseUrl
    ? new GeneCorpus(
        isAbsolute(baseUrl) ? httpReader(baseUrl) : publicDirReader(baseUrl),
      )
    : null
  return serverCorpus
}

/**
 * For the health check: is the configured corpus reachable right now? A
 * HEAD on the index (or a stat on disk) rather than a download, and never
 * the in-memory copy, which would answer from memory. Resolves null when
 * genes come from Postgres.
 */
export async function probeGeneData(): Promise<'ok' | null> {
  const baseUrl = geneDataUrl()
  if (!baseUrl) return null
  if (isAbsolute(baseUrl)) {
    const response = await fetch(`${baseUrl}/${INDEX_PATH}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } else {
    await access(join(publicDir(baseUrl), INDEX_PATH))
  }
  return 'ok'
}
