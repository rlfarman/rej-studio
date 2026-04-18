import { getDb } from '@/drizzle/db'
import { SelectGene, genes, isoforms } from '@/drizzle/schema'
import { sql, eq } from 'drizzle-orm'
import {
  ENST_REGEX,
  ENSG_REGEX,
} from '@/features/gene-search/utils/ensembl-regex'
import { cacheLife, cacheTag } from 'next/cache'

// Tag all gene/isoform query caches so the entire gene corpus can be
// invalidated in one call (`revalidateTag('genes')`) after a reseed, without
// tracking every query variant we ever cached.
const GENES_CACHE_TAG = 'genes'

export type GeneSearchResult = Pick<
  SelectGene,
  'id' | 'name' | 'symbol' | 'species'
> & {
  matchedIsoformId?: string
}

const geneSearchColumns = {
  id: genes.id,
  name: genes.name,
  symbol: genes.symbol,
  species: genes.species,
} as const

/**
 * Cached gene search. Gene data is read-only (only changes on re-seed), so
 * we cache for an hour and tag entries so a reseed can invalidate everything
 * at once via `revalidateTag('genes')`. Debounced typing produces a fresh
 * cache key per character, so a long TTL pays off across sessions.
 */
export async function fetchGenesBySearch(
  trimmedQuery: string,
  species: string,
): Promise<GeneSearchResult[]> {
  'use cache'
  cacheTag(GENES_CACHE_TAG)
  cacheLife({ revalidate: 3600 })

  const db = await getDb()

  if (ENST_REGEX.test(trimmedQuery)) {
    const [result] = await db
      .select({ ...geneSearchColumns, matchedIsoformId: isoforms.id })
      .from(isoforms)
      .innerJoin(genes, eq(isoforms.geneId, genes.id))
      .where(eq(isoforms.id, trimmedQuery))
      .limit(1)
    return result ? [result] : []
  }

  if (ENSG_REGEX.test(trimmedQuery)) {
    const [result] = await db
      .select(geneSearchColumns)
      .from(genes)
      .where(eq(genes.id, trimmedQuery))
      .limit(1)
    return result ? [result] : []
  }

  const lowerQuery = trimmedQuery.toLowerCase()
  const speciesMatch =
    species !== 'both' ? eq(genes.species, species) : undefined

  // Use tsvector full-text search with GIN index when the search_vector
  // column is populated. Falls back to LIKE for compatibility (e.g. if
  // the migration hasn't run yet, or on a non-Postgres backend).
  //
  // plainto_tsquery('simple', ...) handles multi-word queries and avoids
  // syntax errors from user input. The 'simple' config matches the one
  // used to build the tsvector (no stemming — gene symbols are proper nouns).
  const tsQuery = sql`plainto_tsquery('simple', ${trimmedQuery})`
  const ftsMatch = sql`${genes.searchVector} @@ ${tsQuery}`
  const ftsRank = sql<number>`ts_rank(${genes.searchVector}, ${tsQuery})`

  // LIKE fallback for partial matches the tsvector might miss (e.g. substring
  // matches like "BRC" matching "BRCA1"). Combined with OR so both paths
  // contribute results.
  const containsPattern = `%${lowerQuery}%`
  const symbolMatch = sql`LOWER(${genes.symbol}) LIKE ${containsPattern}`
  const nameMatch = sql`LOWER(${genes.name}) LIKE ${containsPattern}`
  const altMatch = sql`LOWER(${genes.alternateSymbols}) LIKE ${containsPattern}`

  const whereClause = speciesMatch
    ? sql`(${ftsMatch} OR ${symbolMatch} OR ${nameMatch} OR ${altMatch}) AND ${speciesMatch}`
    : sql`${ftsMatch} OR ${symbolMatch} OR ${nameMatch} OR ${altMatch}`

  // Rank: FTS rank first (higher is better), then fall back to positional
  // ranking for LIKE-only matches.
  const prefixPattern = `${lowerQuery}%`
  const likeRank = sql<number>`
    CASE
      WHEN LOWER(${genes.symbol}) = ${lowerQuery} THEN 0
      WHEN LOWER(${genes.symbol}) LIKE ${prefixPattern} THEN 1
      WHEN LOWER(${genes.name}) LIKE ${prefixPattern} THEN 2
      WHEN LOWER(${genes.symbol}) LIKE ${containsPattern} THEN 3
      WHEN LOWER(${genes.name}) LIKE ${containsPattern} THEN 4
      ELSE 5
    END
  `

  return db
    .select(geneSearchColumns)
    .from(genes)
    .where(whereClause)
    .orderBy(sql`${ftsRank} DESC`, likeRank, genes.name)
    .limit(6)
}

export async function fetchGeneBySymbol(
  symbol: string,
  species: string | undefined,
) {
  'use cache'
  cacheTag(GENES_CACHE_TAG)
  cacheLife({ revalidate: 3600 })

  const conditions =
    species && species !== 'both'
      ? sql`${eq(genes.symbol, symbol)} AND ${eq(genes.species, species)}`
      : eq(genes.symbol, symbol)

  const db = await getDb()
  const [gene] = await db
    .select(geneSearchColumns)
    .from(genes)
    .where(conditions)
    .limit(1)

  return gene ?? null
}

/**
 * Find genes with symbols similar to the input. Tries prefix match first,
 * then substring match, then partial prefix (first 3+ chars). Returns up
 * to 5 distinct suggestions.
 */
export async function fetchSimilarGenes(
  upperSymbol: string,
): Promise<{ symbol: string; species: string }[]> {
  'use cache'
  cacheTag(GENES_CACHE_TAG)
  cacheLife({ revalidate: 3600 })

  const prefix = `${upperSymbol}%`
  const contains = `%${upperSymbol}%`
  // For short symbols, try matching with just the first few characters
  const shortPrefix =
    upperSymbol.length >= 3 ? `${upperSymbol.slice(0, 3)}%` : prefix

  const db = await getDb()
  const results = await db
    .select({ symbol: genes.symbol, species: genes.species })
    .from(genes)
    .where(
      sql`UPPER(${genes.symbol}) LIKE ${prefix}
        OR UPPER(${genes.symbol}) LIKE ${contains}
        OR UPPER(${genes.symbol}) LIKE ${shortPrefix}`,
    )
    .orderBy(
      // Exact prefix matches first, then substring, then partial
      sql`CASE
        WHEN UPPER(${genes.symbol}) LIKE ${prefix} THEN 0
        WHEN UPPER(${genes.symbol}) LIKE ${contains} THEN 1
        ELSE 2
      END`,
      genes.symbol,
    )
    .limit(5)

  return results
}
