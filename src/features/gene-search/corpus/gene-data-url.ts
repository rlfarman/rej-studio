import { GeneCorpus, type CorpusReader } from './client'

/** Where `pnpm corpus:build` writes the committed sample (under public/). */
const SAMPLE_GENE_DATA_URL = '/gene-data/sample'

/** Genes in the committed sample (checked against it in gene-data-url.test.ts). */
export const SAMPLE_GENE_COUNT = 24

/**
 * The static corpus's base URL (one version directory, no trailing slash).
 *
 * VITE_GENE_DATA_URL picks it at build time: an absolute URL (R2, a CDN)
 * or a path the app serves from public/. Unset, the app reads the committed
 * 24-gene sample, which ships with every build, so a deployment meant for
 * the lab must set it to the full corpus.
 */
export function geneDataUrl(): string {
  const configured = import.meta.env.VITE_GENE_DATA_URL?.trim()
  return configured ? configured.replace(/\/+$/, '') : SAMPLE_GENE_DATA_URL
}

/**
 * Whether this build reads the committed sample rather than a real corpus,
 * so the app can say so: a deployment that forgot VITE_GENE_DATA_URL must
 * not pass for the lab's dataset.
 */
export function usesSampleCorpus(): boolean {
  return geneDataUrl() === SAMPLE_GENE_DATA_URL
}

/** Reads corpus files over HTTP; a 404 is "no such file". */
/** Reads corpus files over HTTP; also used by the search worker. */
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
 * The browser's corpus, shared by every search surface and page so the
 * index downloads once per page load.
 */
export function getBrowserCorpus(): GeneCorpus {
  const baseUrl = geneDataUrl()
  if (browserCorpus?.baseUrl !== baseUrl) {
    browserCorpus = { baseUrl, corpus: new GeneCorpus(httpReader(baseUrl)) }
  }
  return browserCorpus.corpus
}
