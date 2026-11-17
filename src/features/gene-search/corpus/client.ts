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
  MANIFEST_PATH,
  geneFilePath,
  symbolShardKey,
  symbolShardPath,
  transcriptShardOf,
  transcriptShardPath,
  type CorpusManifest,
  type GeneFile,
  type GeneIndexFile,
  type GeneTable,
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
  private readonly symbolShards = new Map<
    string,
    Promise<GeneSearchIndex | null>
  >()
  private shardCount: Promise<number> | null = null

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

  /**
   * How many transcript shards there are, from the small manifest rather
   * than the 1 MB index. A corpus built before the manifest existed has
   * none, and then the index says.
   */
  private transcriptShardCount(): Promise<number> {
    this.shardCount ??= this.read(MANIFEST_PATH)
      .then((file) => {
        const manifest = file as CorpusManifest | null
        if (
          manifest?.format === CORPUS_FORMAT &&
          Number.isInteger(manifest.transcriptShards) &&
          manifest.transcriptShards > 0
        ) {
          return manifest.transcriptShards
        }
        return this.loadIndex().then((index) => index.transcriptShards)
      })
      .catch((error: unknown) => {
        this.shardCount = null
        throw error
      })
    return this.shardCount
  }

  private shard(n: number) {
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

  async geneIdOfTranscript(transcriptId: string): Promise<string | null> {
    const n = transcriptShardOf(transcriptId, await this.transcriptShardCount())
    const shard = await this.shard(n)
    return Object.hasOwn(shard, transcriptId) ? shard[transcriptId] : null
  }

  /** The genes whose symbol starts like `symbol`: one small file. */
  private symbolShard(symbol: string): Promise<GeneSearchIndex | null> {
    const key = symbolShardKey(symbol)
    let shard = this.symbolShards.get(key)
    if (!shard) {
      shard = this.read(symbolShardPath(key)).then((file) => {
        const table = file as GeneTable | null
        return table?.format === CORPUS_FORMAT
          ? new GeneSearchIndex(table)
          : null
      })
      shard.catch(() => this.symbolShards.delete(key))
      this.symbolShards.set(key, shard)
    }
    return shard
  }

  /**
   * A gene by symbol (GeneSearchIndex.geneBySymbol), from its symbol shard,
   * so a gene page opened from a link does not wait for the whole index.
   * No shard (an empty or symbol-less query) means no such gene.
   */
  async geneBySymbol(
    symbol: string,
    species: string | undefined,
  ): Promise<GeneSearchResult | null> {
    if (symbol.trim() === '') return null
    const shard = await this.symbolShard(symbol)
    return shard ? shard.geneBySymbol(symbol, species) : null
  }

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
