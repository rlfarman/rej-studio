import { createLogger } from '@/lib/logger'

import { searchCorpus } from '../corpus/client'
import { geneDataUrl, getBrowserCorpus } from '../corpus/gene-data-url'
import type {
  SearchGenesResult,
  SearchRequest,
  SimilarGene,
} from '../types/search'
import type {
  SearchWorkerRequest,
  SearchWorkerResponse,
} from '../workers/search-protocol'

/**
 * Gene search for the page, run in the search worker
 * (../workers/search.worker.ts) so the index never blocks the main thread.
 *
 * Where there is no Worker (unit tests, very old browsers), or the worker
 * cannot start, the same calls run here on the main thread against
 * `getBrowserCorpus()`: slower to start, same answers.
 */

const log = createLogger('gene-search')

type Pending = {
  resolve: (value: SearchWorkerResponse) => void
}

let worker: Worker | null = null
let unavailable = false
let nextId = 1
const pending = new Map<number, Pending>()

function failAll(message: string) {
  for (const [id, { resolve }] of pending) resolve({ id, ok: false, message })
  pending.clear()
}

function getWorker(): Worker | null {
  if (unavailable || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(
      new URL('../workers/search.worker.ts', import.meta.url),
      {
        type: 'module',
        name: 'rej-gene-search',
      },
    )
  } catch (error) {
    unavailable = true
    log.warn('gene search worker unavailable; searching on the main thread', {
      reason: error instanceof Error ? error.name : 'unknown',
    })
    return null
  }
  worker.addEventListener(
    'message',
    (event: MessageEvent<SearchWorkerResponse>) => {
      const entry = pending.get(event.data.id)
      if (!entry) return
      pending.delete(event.data.id)
      entry.resolve(event.data)
    },
  )
  worker.addEventListener('error', (event) => {
    // A worker that failed to load or crashed answers nothing more: settle
    // what it owed, and let the next call start a fresh one.
    log.warn('gene search worker failed', { message: event.message })
    worker?.terminate()
    worker = null
    failAll(event.message || 'The gene search worker stopped.')
  })
  return worker
}

type Call =
  | { type: 'search'; request: SearchRequest }
  | { type: 'similar'; symbol: string }
  | { type: 'prefetch' }

async function call(message: Call): Promise<unknown> {
  const active = getWorker()
  if (!active) return runHere(message)
  const id = nextId++
  const reply = await new Promise<SearchWorkerResponse>((resolve) => {
    pending.set(id, { resolve })
    const request: SearchWorkerRequest = {
      ...message,
      id,
      baseUrl: absoluteBaseUrl(),
    }
    active.postMessage(request)
  })
  if (!reply.ok) throw new Error(reply.message)
  return reply.result
}

/**
 * The corpus URL as the worker must see it: a same-origin path like
 * /gene-data/sample would otherwise resolve against the worker script's URL.
 */
function absoluteBaseUrl(): string {
  return new URL(geneDataUrl(), location.origin).toString().replace(/\/+$/, '')
}

async function runHere(message: Call): Promise<unknown> {
  const corpus = getBrowserCorpus()
  switch (message.type) {
    case 'search':
      return searchCorpus(corpus, message.request)
    case 'similar':
      return corpus.similarGenes(message.symbol)
    case 'prefetch':
      ;(await corpus.loadIndex()).warm()
      return null
  }
}

/** A search, as `searchCorpus` answers it. */
export function searchGenes(
  request: SearchRequest,
): Promise<SearchGenesResult> {
  return call({ type: 'search', request }) as Promise<SearchGenesResult>
}

/** "Did you mean" symbols for a symbol that matched nothing. */
export function similarGenes(lowerSymbol: string): Promise<SimilarGene[]> {
  return call({ type: 'similar', symbol: lowerSymbol }) as Promise<
    SimilarGene[]
  >
}

/** Downloads and indexes the corpus ahead of the first search. */
export async function prefetchGeneIndex(): Promise<void> {
  await call({ type: 'prefetch' })
}
