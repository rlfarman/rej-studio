/**
 * The static gene corpus: what `scripts/build-gene-corpus.ts` writes and
 * what the app reads, over HTTP or from disk.
 *
 *   <base>/manifest.json           counts and the transcript shard count (CorpusManifest)
 *   <base>/index.json              every gene's searchable fields (GeneIndexFile)
 *   <base>/genes/<geneId>.json     one gene and its isoforms (GeneFile)
 *   <base>/transcripts/<n>.json    transcript id → gene id, sharded (TranscriptShard)
 *   <base>/symbols/<key>.json      the index rows whose symbol starts with <key> (GeneTable)
 *
 * The browser loads index.json (about 1 MB compressed) once and searches all
 * of it. The symbol shards and manifest are for lookups that should not wait
 * for that: a gene page by symbol reads one small shard, and a transcript
 * lookup reads the manifest (for the shard count) and one transcript shard.
 * The Worker reads them too, where parsing the whole index per request
 * would cost too much CPU. Every key is derivable from the query, so nothing needs a
 * directory listing.
 *
 * `<base>` names one corpus version (e.g. `…/v1`), and nothing under it is
 * ever rewritten: a new snapshot gets a new directory, so every file can be
 * cached forever.
 */

/** Bump when the layout changes in a way old readers can't handle. */
export const CORPUS_FORMAT = 1

export interface CorpusGene {
  id: string
  symbol: string
  name: string
  species: string
  /** Pipe-delimited with leading and trailing pipes (`|P53|LFS1|`), or ''. */
  alternateSymbols: string
}

export interface CorpusIsoform {
  id: string
  codingSequenceLength: number
  proteinSequenceLength: number
  codingSequence: string
  proteinSequence: string
  species: string
}

/**
 * Pairwise protein identity of the isoforms the gene page's matrix shows,
 * from a global alignment (Needleman–Wunsch/Gotoh, BLOSUM62, gap open 11,
 * extend 1) computed at corpus-build time by the Rust crate's
 * `isoform-identities` example. Stored rather than computed in the browser
 * because alignment is too slow there and a cheap shortcut was badly wrong.
 */
export interface StoredIsoformIdentity {
  /** Transcript ids in display order: `selectIdentityIsoforms` (identity.ts). */
  isoforms: string[]
  /**
   * Identical aligned columns over alignment columns (gaps count), in tenths
   * of a percent (0–1000), for the upper triangle row by row: (0,1), (0,2),
   * …, (0,n-1), (1,2), …. Integers keep it short and exact.
   */
  permille: number[]
}

/** `genes/<geneId>.json`. Isoforms are sorted by id. */
export interface GeneFile extends CorpusGene {
  isoforms: CorpusIsoform[]
  /**
   * Absent from corpora built before alignments were stored; the matrix then
   * says identities are unavailable (validated by `parseIsoformIdentity`).
   */
  isoformIdentity?: StoredIsoformIdentity
}

/**
 * Gene rows stored column by column (parallel arrays), because repeated
 * keys would double the size before compression. Genes are sorted by id.
 * A symbol shard is exactly this.
 */
export interface GeneTable {
  format: typeof CORPUS_FORMAT
  version: string
  /** Distinct species; `genes.species` holds indexes into this list. */
  species: string[]
  genes: {
    id: string[]
    symbol: string[]
    name: string[]
    species: number[]
    alternateSymbols: string[]
  }
}

/** `index.json`: every gene. */
export interface GeneIndexFile extends GeneTable {
  geneCount: number
  isoformCount: number
  /** How many `transcripts/<n>.json` shards there are. */
  transcriptShards: number
}

/**
 * `manifest.json`: what a reader needs before it has the index. Corpora
 * built before it existed lack the file; readers fall back to the index.
 */
export interface CorpusManifest {
  format: typeof CORPUS_FORMAT
  version: string
  geneCount: number
  isoformCount: number
  transcriptShards: number
}

/** `transcripts/<n>.json`: transcript id → gene id. */
export type TranscriptShard = Record<string, string>

export const INDEX_PATH = 'index.json'
export const MANIFEST_PATH = 'manifest.json'

export function geneFilePath(geneId: string): string {
  return `genes/${encodeURIComponent(geneId)}.json`
}

/**
 * Which shard holds a transcript: its numeric part modulo the shard count.
 * Ensembl numbers are dense, so shards come out even.
 */
export function transcriptShardOf(
  transcriptId: string,
  shardCount: number,
): number {
  const digits = /(\d+)$/.exec(transcriptId)?.[1] ?? '0'
  return Number(digits) % shardCount
}

export function transcriptShardPath(shard: number): string {
  return `transcripts/${shard}.json`
}

/**
 * The symbol shard a symbol (or a query for one) belongs to: its first two
 * characters, lowercased, with anything but a letter or number as `_`. A
 * one-character query spans every shard starting with that character.
 */
export function symbolShardKey(symbol: string): string {
  return symbol
    .toLowerCase()
    .slice(0, 2)
    .replace(/[^a-z0-9]/g, '_')
}

export function symbolShardPath(key: string): string {
  return `symbols/${key}.json`
}
