'use server'

import { db } from '@/drizzle/db'
import { SelectGene, genes, isoforms } from '@/drizzle/schema'
import { openai } from '@/lib/openai'
import { desc, sql, cosineDistance, gt, eq } from 'drizzle-orm'
import { embed } from 'ai'

export type GeneSearchResult = Pick<SelectGene, 'id' | 'name' | 'symbol'> & {
  similarity: number
}

export async function searchGenes(
  query: string
): Promise<Array<GeneSearchResult>> {
  try {
    if (query.trim().length === 0) return []

    const embedding = await generateEmbedding(query)
    const vectorQuery = `[${embedding.join(',')}]`

    const similarity = sql<number>`1 - (${cosineDistance(
      genes.embedding,
      vectorQuery
    )})`

    const gene = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        similarity,
      })
      .from(genes)
      .where(gt(similarity, 0.25))
      .orderBy((t) => desc(t.similarity))
      .limit(6)

    return gene
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function generateEmbedding(raw: string) {
  // OpenAI recommends replacing newlines with spaces for best results
  const input = raw.replace(/\n/g, ' ')
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: input,
  })
  return embedding
}

export async function getIsoformsByGene(geneId: string) {
  try {
    const isoformData = await db
      .select({
        id: isoforms.id,
        enst: isoforms.ENST,
        length: isoforms.length,
        species: isoforms.species,
      })
      .from(isoforms)
      .where(eq(isoforms.geneId, geneId))
      // Order by descending enst
      .orderBy(isoforms.ENST)

    return isoformData
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
