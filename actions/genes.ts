'use server'

import { db } from '@/drizzle/db'
import { SelectGene, genes, isoforms } from '@/drizzle/schema'
import { sql, eq, and, or } from 'drizzle-orm'
import { ENST_REGEX, ENSG_REGEX } from '@/lib/regex'
import type { SpeciesFilter } from '@/lib/species'

export type GeneSearchResult = Pick<
  SelectGene,
  'id' | 'name' | 'symbol' | 'species'
>

const geneSearchColumns = {
  id: genes.id,
  name: genes.name,
  symbol: genes.symbol,
  species: genes.species,
} as const

const geneDetailColumns = {
  ...geneSearchColumns,
  ENSG: genes.ENSG,
  chromosome: genes.chromosome,
  diseaseAssociations: genes.diseaseAssociations,
} as const

export async function searchGenes(
  query: string,
  species: SpeciesFilter = 'both',
): Promise<GeneSearchResult[]> {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length === 0) return []

  if (ENST_REGEX.test(trimmedQuery)) {
    const [result] = await db
      .select(geneSearchColumns)
      .from(isoforms)
      .innerJoin(genes, eq(isoforms.geneId, genes.id))
      .where(eq(isoforms.ENST, trimmedQuery))
      .limit(1)
    return result ? [result] : []
  }

  if (ENSG_REGEX.test(trimmedQuery)) {
    const [result] = await db
      .select(geneSearchColumns)
      .from(genes)
      .where(eq(genes.ENSG, trimmedQuery))
      .limit(1)
    return result ? [result] : []
  }

  const lowerQuery = trimmedQuery.toLowerCase()
  const prefixPattern = `${lowerQuery}%`
  const containsPattern = `%${lowerQuery}%`

  return db
    .select(geneSearchColumns)
    .from(genes)
    .where(
      and(
        or(
          sql`LOWER(${genes.symbol}) LIKE LOWER(${containsPattern})`,
          sql`LOWER(${genes.name}) LIKE LOWER(${containsPattern})`,
          sql`LOWER(${`%${trimmedQuery}%`}) = ANY(SELECT LOWER(x) FROM unnest(${genes.alternateSymbols}) AS x)`,
          sql`EXISTS (SELECT 1 FROM unnest(${genes.diseaseAssociations}) AS da WHERE LOWER(da) LIKE LOWER(${containsPattern}))`,
        ),
        species !== 'both' ? eq(genes.species, species) : sql`TRUE`,
      ),
    )
    .groupBy(genes.id)
    .orderBy(
      sql`CASE
        WHEN LOWER(${genes.symbol}) = ${lowerQuery} THEN 0
        WHEN LOWER(${genes.symbol}) LIKE ${prefixPattern} THEN 1
        WHEN LOWER(${genes.name}) LIKE ${prefixPattern} THEN 2
        WHEN LOWER(${genes.symbol}) LIKE ${containsPattern} THEN 3
        WHEN LOWER(${genes.name}) LIKE ${containsPattern} THEN 4
        ELSE 5
      END`,
      genes.name,
    )
    .limit(6)
}

export async function getGeneBySymbol(symbol: string) {
  const [gene] = await db
    .select(geneDetailColumns)
    .from(genes)
    .where(eq(genes.symbol, symbol))
    .limit(1)

  return gene
}
