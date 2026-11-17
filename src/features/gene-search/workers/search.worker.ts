/// <reference lib="webworker" />

import { GeneCorpus, searchCorpus } from '../corpus/client'
import { httpReader } from '../corpus/gene-data-url'
import type {
  SearchWorkerRequest,
  SearchWorkerResponse,
} from './search-protocol'

/**
 * The gene index, off the main thread.
 *
 * Downloading, parsing and indexing ~40,000 genes, and every search after
 * that, happens here, so none of it can stall typing or scrolling (it was a
 * single ~800 ms main-thread task on a throttled laptop CPU). The corpus is
 * kept for the life of the worker, which is the life of the page.
 */

declare const self: DedicatedWorkerGlobalScope

const corpora = new Map<string, GeneCorpus>()

function corpusFor(baseUrl: string): GeneCorpus {
  let corpus = corpora.get(baseUrl)
  if (!corpus) {
    corpus = new GeneCorpus(httpReader(baseUrl))
    corpora.set(baseUrl, corpus)
  }
  return corpus
}

async function handle(message: SearchWorkerRequest) {
  const corpus = corpusFor(message.baseUrl)
  switch (message.type) {
    case 'search':
      return searchCorpus(corpus, message.request)
    case 'similar':
      return corpus.similarGenes(message.symbol)
    case 'prefetch': {
      const index = await corpus.loadIndex()
      // Built now, while nobody is waiting, rather than on the first query.
      index.warm()
      return null
    }
  }
}

self.addEventListener('message', (event: MessageEvent<SearchWorkerRequest>) => {
  const message = event.data
  handle(message).then(
    (result) => {
      const reply: SearchWorkerResponse = { id: message.id, ok: true, result }
      self.postMessage(reply)
    },
    (error: unknown) => {
      const reply: SearchWorkerResponse = {
        id: message.id,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }
      self.postMessage(reply)
    },
  )
})
