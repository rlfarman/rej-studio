'use server'

import { db } from '@/drizzle/db'
import { SelectGene, genes, isoforms } from '@/drizzle/schema'
import { sql, eq, and, or } from 'drizzle-orm'
import { ENST_REGEX, ENSG_REGEX } from '@/lib/regex'

export type GeneSearchResult = Pick<
  SelectGene,
  'id' | 'name' | 'symbol' | 'species'
>

export async function searchGenes(
  query: string,
  species: string = 'both',
): Promise<Array<GeneSearchResult>> {
  try {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) return []

    if (ENST_REGEX.test(trimmedQuery)) {
      const gene = await searchGeneByENST(trimmedQuery)
      return gene ? [gene] : []
    }

    if (ENSG_REGEX.test(trimmedQuery)) {
      const gene = await searchGeneByENSG(trimmedQuery)
      return gene ? [gene] : []
    }

    const genesResult = db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        species: genes.species,
      })
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

    return genesResult
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function searchGeneByENST(
  enst: string,
): Promise<GeneSearchResult | undefined> {
  try {
    const [result] = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        species: genes.species,
      })
      .from(isoforms)
      .innerJoin(genes, eq(isoforms.geneId, genes.id))
      .where(eq(isoforms.ENST, enst))
      .limit(1)

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function searchGeneByENSG(
  ensg: string,
): Promise<GeneSearchResult | undefined> {
  try {
    const [gene] = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        species: genes.species,
      })
      .from(genes)
      .where(eq(genes.ENSG, ensg))
      .limit(1)

    return gene
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getGeneBySymbol(symbol: string) {
  try {
    const [gene] = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        ENSG: genes.ENSG,
        chromosome: genes.chromosome,
      })
      .from(genes)
      .where(eq(genes.symbol, symbol))
      .limit(1)

    if (gene === undefined) {
      return undefined
    }

    return gene
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getAllGeneSymbols() {
  try {
    const allGenes = await db
      .select({
        symbol: genes.symbol,
      })
      .from(genes)
    return allGenes
  } catch (error) {
    console.error(error)
    throw error
  }
}
