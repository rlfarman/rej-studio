'use server'

import { db } from '@/drizzle/db'
import { SelectGene, genes, isoforms } from '@/drizzle/schema'
import { sql, eq } from 'drizzle-orm'
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
  const prefixPattern = `${lowerQuery}%`
  const containsPattern = `%${lowerQuery}%`

  const speciesFilter =
    species !== 'both' ? sql`AND ${genes.species} = ${species}` : sql``

  const results = await db.all<GeneSearchResult>(sql`
    SELECT ${genes.id} AS id, ${genes.name} AS name, ${genes.symbol} AS symbol, ${genes.species} AS species
    FROM ${genes}
    WHERE (
      LOWER(${genes.symbol}) LIKE ${containsPattern}
      OR LOWER(${genes.name}) LIKE ${containsPattern}
      OR EXISTS (
        SELECT 1 FROM json_each(${genes.alternateSymbols})
        WHERE LOWER(json_each.value) LIKE ${containsPattern}
      )
    )
    ${speciesFilter}
    ORDER BY
      CASE
        WHEN LOWER(${genes.symbol}) = ${lowerQuery} THEN 0
        WHEN LOWER(${genes.symbol}) LIKE ${prefixPattern} THEN 1
        WHEN LOWER(${genes.name}) LIKE ${prefixPattern} THEN 2
        WHEN LOWER(${genes.symbol}) LIKE ${containsPattern} THEN 3
        WHEN LOWER(${genes.name}) LIKE ${containsPattern} THEN 4
        ELSE 5
      END,
      ${genes.name}
    LIMIT 6
  `)

  return results
}

export async function getGeneBySymbol(
  symbol: string,
  species?: SpeciesFilter,
) {
  const speciesCondition =
    species && species !== 'both'
      ? sql`AND ${genes.species} = ${species}`
      : sql``

  const [gene] = await db.all<GeneSearchResult>(sql`
    SELECT ${genes.id} AS id, ${genes.name} AS name, ${genes.symbol} AS symbol, ${genes.species} AS species
    FROM ${genes}
    WHERE ${genes.symbol} = ${symbol}
    ${speciesCondition}
    LIMIT 1
  `)

  return gene
}
