import { ENSG_REGEX, ENST_REGEX } from '../utils/ensembl-regex'
import {
  isSymbolLike,
  type GeneSearchPage,
  type GeneSearchResult,
  type SearchGenesResult,
  type SearchRequest,
  type SimilarGene,
} from '../types/search'
import {
  CORPUS_FORMAT,
  INDEX_PATH,
  geneFilePath,
  transcriptShardOf,
  transcriptShardPath,
  type GeneFile,
  type GeneIndexFile,
  type TranscriptShard,
} from './format'
import { GeneSearchIndex } from './search-index'

/**
 * Reads one corpus file by its path under the version directory. Resolves
 * null when the file doesn't exist (an unknown gene); rejects on any other
 * failure, so "not found" and "unreachable" stay distinguishable.
 */
export type CorpusReader = (path: string) => Promise<unknown>

/**
 * The static corpus, read through `read`. Used in the browser (over fetch)
 * and on the server (fetch or disk). The index and transcript shards are
 * loaded once and kept; gene files are left to the caller's cache.
 */
export class GeneCorpus {
  private index: Promise<GeneSearchIndex> | null = null
  private readonly shards = new Map<number, Promise<TranscriptShard>>()

  constructor(private readonly read: CorpusReader) {}

  /** Load (once) and return the search index. Retries after a failure. */
  loadIndex(): Promise<GeneSearchIndex> {
    this.index ??= this.read(INDEX_PATH).then((file) => {
      const index = file as GeneIndexFile | null
      if (!index || index.format !== CORPUS_FORMAT) {
        throw new Error(
          `Gene index missing or in an unknown format (${String(index?.format)})`,
        )
      }
      return new GeneSearchIndex(index)
    })
    this.index.catch(() => {
      this.index = null
    })
    return this.index
  }

  private shard(index: GeneSearchIndex, transcriptId: string) {
    const n = transcriptShardOf(transcriptId, index.transcriptShards)
    let shard = this.shards.get(n)
    if (!shard) {
      shard = this.read(transcriptShardPath(n)).then(
        (file) => (file ?? {}) as TranscriptShard,
      )
      shard.catch(() => this.shards.delete(n))
      this.shards.set(n, shard)
    }
    return shard
  }

  /** The gene id a transcript belongs to, or null. */
  async geneIdOfTranscript(transcriptId: string): Promise<string | null> {
    const index = await this.loadIndex()
    const shard = await this.shard(index, transcriptId)
    return Object.hasOwn(shard, transcriptId) ? shard[transcriptId] : null
  }

  /** A gene with its isoforms, or null when the corpus has no such gene. */
  async geneFile(geneId: string): Promise<GeneFile | null> {
    return (await this.read(geneFilePath(geneId))) as GeneFile | null
  }

  /** fetchGenesBySearch: Ensembl ids first, then the ranked text search. */
  async searchGenes(
    query: string,
    species: string,
    limit: number,
  ): Promise<GeneSearchPage> {
    const index = await this.loadIndex()

    // Like the SQL, an id lookup ignores the species filter.
    if (ENST_REGEX.test(query)) {
      const geneId = await this.geneIdOfTranscript(query)
      const gene = geneId ? index.gene(geneId) : null
      const results: GeneSearchResult[] = gene
        ? [{ ...gene, matchedIsoformId: query }]
        : []
      return { results, truncated: false }
    }
    if (ENSG_REGEX.test(query)) {
      const gene = index.gene(query)
      return { results: gene ? [gene] : [], truncated: false }
    }
    return index.searchText(query, species, limit)
  }

  async similarGenes(lowerSymbol: string): Promise<SimilarGene[]> {
    return (await this.loadIndex()).similarGenes(lowerSymbol)
  }
}

/**
 * searchGenes in api/genes.ts, for a corpus: trims the query, searches, and
 * offers "did you mean" symbols when nothing matched.
 */
export async function searchCorpus(
  corpus: GeneCorpus,
  { q, species, limit }: SearchRequest,
): Promise<SearchGenesResult> {
  const query = q.trim()
  if (query.length === 0) {
    return { results: [], truncated: false, suggestions: [] }
  }
  const { results, truncated } = await corpus.searchGenes(query, species, limit)
  const suggestions =
    results.length === 0 && isSymbolLike(query)
      ? await corpus.similarGenes(query.toLowerCase().slice(0, 20))
      : []
  return { results, truncated, suggestions }
}
