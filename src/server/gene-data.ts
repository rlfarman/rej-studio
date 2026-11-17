import {
  GeneCorpus,
  type CorpusReader,
} from '@/features/gene-search/corpus/client'
import { INDEX_PATH } from '@/features/gene-search/corpus/format'
import { geneDataUrl } from '@/features/gene-search/corpus/gene-data-url'

import type { ServerEnv } from './env'

/**
 * The gene corpus, read on the Worker.
 *
 * The same files the browser reads (one corpus version, chosen at build time
 * by VITE_GENE_DATA_URL) through the browser's own `GeneCorpus`, so a search
 * from an agent ranks exactly as it does in the app. Only where the bytes
 * come from differs:
 *
 * - **R2** (`GENE_DATA` bound, and the corpus URL absolute): the object keys
 *   are the URL's path, the way a public R2 bucket maps them, so
 *   `https://genes.example.org/v3` reads `v3/index.json`. One setting picks
 *   the version for the browser and the Worker alike, so they cannot drift.
 * - **HTTP** (an absolute URL, no binding): fetched like the browser does.
 * - **Static assets** (a path under public/, i.e. the committed sample):
 *   read through the `ASSETS` binding, with no network round trip.
 */

type GeneDataSource =
  | { kind: 'r2'; bucket: R2Bucket; prefix: string }
  | { kind: 'http'; base: string }
  | { kind: 'assets'; assets: Fetcher; base: string }

function isAbsolute(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function geneDataSource(env: ServerEnv): GeneDataSource | null {
  const base = geneDataUrl()
  if (isAbsolute(base)) {
    if (env.GENE_DATA) {
      const path = new URL(base).pathname.replace(/^\/+|\/+$/g, '')
      return {
        kind: 'r2',
        bucket: env.GENE_DATA,
        prefix: path ? `${path}/` : '',
      }
    }
    return { kind: 'http', base }
  }
  return env.ASSETS ? { kind: 'assets', assets: env.ASSETS, base } : null
}

function readerFor(source: GeneDataSource): CorpusReader {
  switch (source.kind) {
    case 'r2':
      return async (path) => {
        const object = await source.bucket.get(`${source.prefix}${path}`)
        return object ? object.json() : null
      }
    case 'http':
      return async (path) => {
        const response = await fetch(`${source.base}/${path}`)
        if (response.status === 404) return null
        if (!response.ok) {
          throw new Error(`Gene data ${path}: HTTP ${response.status}`)
        }
        return response.json()
      }
    case 'assets':
      return async (path) => {
        // The host is ignored by the assets binding; only the path matters.
        const response = await source.assets.fetch(
          new URL(`${source.base}/${path}`, 'https://assets.invalid'),
        )
        // `not_found_handling: "single-page-application"` answers a missing
        // file with the HTML shell and a 200, so anything that isn't JSON is
        // a file the corpus doesn't have.
        const type = response.headers.get('content-type') ?? ''
        if (response.status === 404 || !type.includes('json')) {
          await response.body?.cancel()
          return null
        }
        if (!response.ok) {
          throw new Error(`Gene data ${path}: HTTP ${response.status}`)
        }
        return response.json()
      }
  }
}

function sourceKey(source: GeneDataSource): string {
  return source.kind === 'r2'
    ? `r2:${source.prefix}`
    : `${source.kind}:${source.base}`
}

/**
 * Kept for the life of the isolate: the corpus holds the parsed search index
 * (about a megabyte of JSON for the full corpus), which is worth parsing once
 * rather than on every tool call.
 */
let cached: { key: string; corpus: GeneCorpus } | null = null

/** The corpus for this Worker, or null when it has no way to read one. */
export function serverCorpus(env: ServerEnv): GeneCorpus | null {
  const source = geneDataSource(env)
  if (!source) return null
  const key = sourceKey(source)
  if (cached?.key !== key) {
    cached = { key, corpus: new GeneCorpus(readerFor(source)) }
  }
  return cached.corpus
}

/**
 * The health check's probe: a `head` of the corpus index in R2, which reads
 * no data. Null when the corpus isn't in R2, since an HTTP or asset probe
 * would test something other than the deployment's own storage.
 */
export async function probeGeneData(
  env: ServerEnv,
): Promise<{ ok: true } | { ok: false; error: string } | null> {
  const source = geneDataSource(env)
  if (source?.kind !== 'r2') return null
  const head = await source.bucket.head(`${source.prefix}${INDEX_PATH}`)
  return head ? { ok: true } : { ok: false, error: `${INDEX_PATH} not found` }
}
