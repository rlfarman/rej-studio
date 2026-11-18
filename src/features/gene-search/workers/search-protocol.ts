import type {
  SearchGenesResult,
  SearchRequest,
  SimilarGene,
} from '../types/search'

/**
 * Messages between the page and the gene search worker
 * (./search.worker.ts, ../api/search-worker-client.ts). Every request names
 * the corpus it is for, so the worker needs no setup message and a change of
 * corpus URL cannot leave it searching the old one.
 */

export type SearchWorkerRequest = { id: number; baseUrl: string } & (
  | { type: 'search'; request: SearchRequest }
  | { type: 'similar'; symbol: string }
  | { type: 'prefetch' }
)

export type SearchWorkerResponse =
  | { id: number; ok: true; result: SearchGenesResult | SimilarGene[] | null }
  | { id: number; ok: false; message: string }
