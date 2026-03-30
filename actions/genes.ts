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

  return db
    .select(geneSearchColumns)
    .from(genes)
    .where(
      and(
        or(
          sql`LOWER(${genes.name}) LIKE LOWER(${`%${trimmedQuery}%`})`,
          sql`LOWER(${genes.symbol}) LIKE LOWER(${`%${trimmedQuery}%`})`,
          sql`${`%${trimmedQuery}%`} = ANY(${genes.alternateSymbols})`,
        ),
        species !== 'both' ? eq(genes.species, species) : sql`TRUE`,
      ),
    )
    .groupBy(genes.id)
    .orderBy(genes.name)
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
