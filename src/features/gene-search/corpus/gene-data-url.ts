import { GeneCorpus, type CorpusReader } from './client'

/** Where `pnpm corpus:build` writes the committed sample (under public/). */
const SAMPLE_GENE_DATA_URL = '/gene-data/sample'

/**
 * The static corpus's base URL (one version directory, no trailing slash),
 * or null to keep reading genes from Postgres.
 *
 * NEXT_PUBLIC_GENE_DATA_URL picks it explicitly: an absolute URL (R2, a
 * CDN) or a path the app serves from public/. Unset, development and tests
 * use the committed sample, while production stays on Postgres until the
 * full corpus is hosted somewhere. Next inlines both variables, so the
 * browser and the server always agree.
 */
export function geneDataUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_GENE_DATA_URL
  if (configured) return configured.replace(/\/+$/, '')
  return process.env.NODE_ENV === 'production' ? null : SAMPLE_GENE_DATA_URL
}

/** Reads corpus files over HTTP; a 404 is "no such file". */
export function httpReader(baseUrl: string): CorpusReader {
  return async (path) => {
    const response = await fetch(`${baseUrl}/${path}`)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Gene data ${path}: HTTP ${response.status}`)
    }
    return response.json()
  }
}

let browserCorpus: { baseUrl: string; corpus: GeneCorpus } | null = null

/**
 * The browser's corpus, shared by every search surface so the index
 * downloads once per page load. Null when genes come from Postgres.
 */
export function getBrowserCorpus(): GeneCorpus | null {
  const baseUrl = geneDataUrl()
  if (!baseUrl) return null
  if (browserCorpus?.baseUrl !== baseUrl) {
    browserCorpus = { baseUrl, corpus: new GeneCorpus(httpReader(baseUrl)) }
  }
  return browserCorpus.corpus
}
