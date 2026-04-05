'use server'

import { db } from '@/drizzle/db'
import { SelectGene, genes, isoforms } from '@/drizzle/schema'
import { sql, eq, or } from 'drizzle-orm'
import {
  ENST_REGEX,
  ENSG_REGEX,
} from '@/features/gene-search/utils/ensembl-regex'
import { speciesFilterSchema, type SpeciesFilter } from '@/lib/bio/species'
import { z } from 'zod'

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

// Defense-in-depth: server actions are reachable from any caller (client, other
// server code), so re-validate inputs at the boundary even though call-sites
// pass typed values. A hostile client can construct arbitrary payloads.
const searchGenesInput = z.object({
  query: z.string().max(200),
  species: speciesFilterSchema.default('both'),
})

const geneSymbolInput = z.object({
  symbol: z.string().min(1).max(100),
  species: speciesFilterSchema.optional(),
})

export async function searchGenes(
  query: string,
  species: SpeciesFilter = 'both',
): Promise<GeneSearchResult[]> {
  const parsed = searchGenesInput.parse({ query, species })
  const trimmedQuery = parsed.query.trim()
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
    parsed.species !== 'both' ? eq(genes.species, parsed.species) : undefined

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
  const parsed = geneSymbolInput.parse({ symbol, species })
  const conditions =
    parsed.species && parsed.species !== 'both'
      ? sql`${eq(genes.symbol, parsed.symbol)} AND ${eq(genes.species, parsed.species)}`
      : eq(genes.symbol, parsed.symbol)

  const [gene] = await db
    .select(geneSearchColumns)
    .from(genes)
    .where(conditions)
    .limit(1)

  return gene
}
