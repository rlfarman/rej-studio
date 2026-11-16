import 'server-only'
import { getDb } from '@/drizzle/db'
import { genes, isoforms } from '@/drizzle/schema'
import { and, sql, eq, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  ENST_REGEX,
  ENSG_REGEX,
} from '@/features/gene-search/utils/ensembl-regex'
import { escapeLikePattern } from '@/features/gene-search/utils/like-pattern'
import { cacheLife, cacheTag } from 'next/cache'
import { getServerCorpus } from './static-gene-data'
import type {
  GeneSearchPage,
  GeneSearchResult,
  SimilarGene,
} from '@/features/gene-search/types/search'

// Two backends sit behind these functions. When a static corpus is
// configured (corpus/gene-data-url.ts: always in development and tests,
// in production only once NEXT_PUBLIC_GENE_DATA_URL is set), each function
// answers from it, ranking the same way as the SQL below
// (corpus/search-index.ts mirrors each query). Otherwise they query
// Postgres exactly as before, which is what production runs today.
//
// Tag all gene/isoform query caches so the entire gene corpus can be
// invalidated in one call (`revalidateTag('genes')`) after a reseed, without
// tracking every query variant we ever cached.
//
// Two cache tiers, chosen per query:
// - 'use cache: remote' for lookups many requests share (a gene by symbol,
//   its isoforms). Plain 'use cache' is per-instance memory, which on
//   serverless rarely survives between requests, so it barely shields the
//   database; the remote tier (Vercel Runtime Cache) is shared and durable.
//   The data is read-only, so these use the 'max' lifetime. Entries are
//   scoped to a deployment, so a deploy starts cold.
// - plain 'use cache' for search and suggestions, whose keys are mostly
//   unique keystroke prefixes. Remote writes there would cost more than
//   the rare hit saves.
const GENES_CACHE_TAG = 'genes'

const geneSearchColumns = {
  id: genes.id,
  name: genes.name,
  symbol: genes.symbol,
  species: genes.species,
} as const

/**
 * `lower(col) LIKE pattern` with an explicit escape character, so escaped
 * `%`/`_` from user input match literally on any dialect. The lower() form
 * matches the trigram and expression indexes in schema.ts.
 */
function lowerLike(column: AnyPgColumn, pattern: string): SQL {
  return sql`lower(${column}) LIKE ${pattern} ESCAPE '\\'`
}

/**
 * Cached gene search (per-instance memory; see the cache-tier note above).
 * Gene data is read-only (only changes on re-seed), so we cache for an hour
 * and tag entries so a reseed can invalidate everything at once via
 * `revalidateTag('genes')`.
 *
 * Fetches one row past `limit` to tell the caller whether results were cut.
 */
export async function fetchGenesBySearch(
  trimmedQuery: string,
  species: string,
  limit: number,
): Promise<GeneSearchPage> {
  'use cache'
  cacheTag(GENES_CACHE_TAG)
  cacheLife({ revalidate: 3600 })

  const corpus = getServerCorpus()
  if (corpus) return corpus.searchGenes(trimmedQuery, species, limit)

  const db = await getDb()

  if (ENST_REGEX.test(trimmedQuery)) {
    const [result] = await db
      .select({ ...geneSearchColumns, matchedIsoformId: isoforms.id })
      .from(isoforms)
      .innerJoin(genes, eq(isoforms.geneId, genes.id))
      .where(eq(isoforms.id, trimmedQuery))
      .limit(1)
    return { results: result ? [result] : [], truncated: false }
  }

  if (ENSG_REGEX.test(trimmedQuery)) {
    const [result] = await db
      .select(geneSearchColumns)
      .from(genes)
      .where(eq(genes.id, trimmedQuery))
      .limit(1)
    return { results: result ? [result] : [], truncated: false }
  }

  const lowerQuery = trimmedQuery.toLowerCase()
  const escaped = escapeLikePattern(lowerQuery)
  const speciesMatch =
    species !== 'both' ? eq(genes.species, species) : undefined

  // Use tsvector full-text search with GIN index when the search_vector
  // column is populated (scripts/populate-search-vector.sql).
  //
  // plainto_tsquery('simple', ...) handles multi-word queries and avoids
  // syntax errors from user input. The 'simple' config matches the one
  // used to build the tsvector (no stemming — gene symbols are proper nouns).
  const tsQuery = sql`plainto_tsquery('simple', ${trimmedQuery})`
  const ftsMatch = sql`${genes.searchVector} @@ ${tsQuery}`
  const ftsRank = sql<number>`ts_rank(${genes.searchVector}, ${tsQuery})`

  // Substring matches the tsvector misses (e.g. "BRC" matching "BRCA1").
  // OR'd with the full-text match; each branch is served by its own GIN
  // index (trigram for the LIKEs), so Postgres can combine bitmap scans
  // instead of scanning the table.
  const containsPattern = `%${escaped}%`
  const prefixPattern = `${escaped}%`
  const textMatch = sql`(${ftsMatch} OR ${lowerLike(genes.symbol, containsPattern)} OR ${lowerLike(genes.name, containsPattern)} OR ${lowerLike(genes.alternateSymbols, containsPattern)})`

  // Exact symbol first, then full-text rank, then positional ranking for
  // LIKE-only matches. NULLS LAST: rows without a search vector rank 0.
  const exactRank = sql`CASE WHEN lower(${genes.symbol}) = ${lowerQuery} THEN 0 ELSE 1 END`
  const likeRank = sql<number>`
    CASE
      WHEN ${lowerLike(genes.symbol, prefixPattern)} THEN 1
      WHEN ${lowerLike(genes.name, prefixPattern)} THEN 2
      WHEN ${lowerLike(genes.symbol, containsPattern)} THEN 3
      WHEN ${lowerLike(genes.name, containsPattern)} THEN 4
      ELSE 5
    END
  `

  const rows = await db
    .select(geneSearchColumns)
    .from(genes)
    .where(and(textMatch, speciesMatch))
    .orderBy(
      exactRank,
      sql`${ftsRank} DESC NULLS LAST`,
      likeRank,
      genes.name,
      genes.id,
    )
    .limit(limit + 1)

  return { results: rows.slice(0, limit), truncated: rows.length > limit }
}

/**
 * A gene by symbol, case-insensitively, so /genes/tp53 finds TP53. When the
 * casing is ambiguous (human BRCA1 and a mouse gene spelled the same way),
 * an exact-case match wins, then human. The caller redirects to the
 * canonical casing.
 */
export async function fetchGeneBySymbol(
  symbol: string,
  species: string | undefined,
): Promise<GeneSearchResult | null> {
  'use cache: remote'
  cacheTag(GENES_CACHE_TAG)
  cacheLife('max')

  const corpus = getServerCorpus()
  if (corpus) return (await corpus.loadIndex()).geneBySymbol(symbol, species)

  const symbolMatch = sql`lower(${genes.symbol}) = ${symbol.toLowerCase()}`
  const speciesMatch =
    species && species !== 'both' ? eq(genes.species, species) : undefined

  const db = await getDb()
  const [gene] = await db
    .select(geneSearchColumns)
    .from(genes)
    .where(and(symbolMatch, speciesMatch))
    .orderBy(
      sql`CASE WHEN ${genes.symbol} = ${symbol} THEN 0 ELSE 1 END`,
      genes.species,
      genes.id,
    )
    .limit(1)

  return gene ?? null
}

/**
 * Every gene's symbol and species, for the sitemap. One full scan of the
 * genes table, so it lives in the shared remote cache rather than running
 * per request.
 */
export async function fetchAllGeneSymbols(): Promise<
  { symbol: string; species: string }[]
> {
  'use cache: remote'
  cacheTag(GENES_CACHE_TAG)
  cacheLife('max')

  const corpus = getServerCorpus()
  if (corpus) return (await corpus.loadIndex()).allSymbols()

  const db = await getDb()
  return db.select({ symbol: genes.symbol, species: genes.species }).from(genes)
}

/**
 * Find genes with symbols similar to the input. Tries prefix match first,
 * then substring match, then partial prefix (first 3+ chars). Returns up
 * to 5 distinct suggestions. Per-instance cache: these are lookups for
 * arbitrary input (404s, empty searches), so remote entries would rarely be
 * reused.
 */
export async function fetchSimilarGenes(
  lowerSymbol: string,
): Promise<SimilarGene[]> {
  'use cache'
  cacheTag(GENES_CACHE_TAG)
  cacheLife({ revalidate: 3600 })

  const corpus = getServerCorpus()
  if (corpus) return corpus.similarGenes(lowerSymbol)

  const escaped = escapeLikePattern(lowerSymbol)
  const prefix = `${escaped}%`
  const contains = `%${escaped}%`
  // For short symbols, try matching with just the first few characters
  const shortPrefix =
    lowerSymbol.length >= 3
      ? `${escapeLikePattern(lowerSymbol.slice(0, 3))}%`
      : prefix

  const db = await getDb()
  return db
    .select({ symbol: genes.symbol, species: genes.species })
    .from(genes)
    .where(
      sql`${lowerLike(genes.symbol, prefix)}
        OR ${lowerLike(genes.symbol, contains)}
        OR ${lowerLike(genes.symbol, shortPrefix)}`,
    )
    .orderBy(
      // Exact prefix matches first, then substring, then partial
      sql`CASE
        WHEN ${lowerLike(genes.symbol, prefix)} THEN 0
        WHEN ${lowerLike(genes.symbol, contains)} THEN 1
        ELSE 2
      END`,
      genes.symbol,
      genes.species,
    )
    .limit(5)
}
