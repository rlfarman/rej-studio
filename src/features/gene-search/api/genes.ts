'use server'

import { db } from '@/drizzle/db'
import { SelectGene, genes, isoforms } from '@/drizzle/schema'
import { sql, eq, or } from 'drizzle-orm'
import {
  ENST_REGEX,
  ENSG_REGEX,
} from '@/features/gene-search/utils/ensembl-regex'
import type { SpeciesFilter } from '@/lib/bio/species'

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

export async function searchGenes(
  query: string,
  species: SpeciesFilter = 'both',
): Promise<GeneSearchResult[]> {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length === 0) return []

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

  // Dialect-neutral search: LOWER(col) LIKE '%query%' works in Postgres, SQLite,
  // and MySQL without modification (no ILIKE, no dialect-specific operators).
  // alternateSymbols stores original casing (pipe-delimited) for display, so we
  // LOWER() it at query time too.
  const lowerQuery = trimmedQuery.toLowerCase()
  const prefixPattern = `${lowerQuery}%`
  const containsPattern = `%${lowerQuery}%`

  const symbolMatch = sql`LOWER(${genes.symbol}) LIKE ${containsPattern}`
  const nameMatch = sql`LOWER(${genes.name}) LIKE ${containsPattern}`
  const altMatch = sql`LOWER(${genes.alternateSymbols}) LIKE ${containsPattern}`
  const speciesMatch =
    species !== 'both' ? eq(genes.species, species) : undefined

  const rankExpression = sql<number>`
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
    .where(
      speciesMatch
        ? sql`(${or(symbolMatch, nameMatch, altMatch)}) AND ${speciesMatch}`
        : or(symbolMatch, nameMatch, altMatch),
    )
    .orderBy(rankExpression, genes.name)
    .limit(6)
}

export async function getGeneBySymbol(symbol: string, species?: SpeciesFilter) {
  const conditions =
    species && species !== 'both'
      ? sql`${eq(genes.symbol, symbol)} AND ${eq(genes.species, species)}`
      : eq(genes.symbol, symbol)

  const [gene] = await db
    .select(geneSearchColumns)
    .from(genes)
    .where(conditions)
    .limit(1)

  return gene
}
