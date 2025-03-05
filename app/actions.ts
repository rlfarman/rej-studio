'use server'

import { db } from '@/drizzle/db'
import { SelectGene, genes, isoforms } from '@/drizzle/schema'
import { openai } from '@/lib/openai'
import { desc, sql, cosineDistance, gt, eq } from 'drizzle-orm'
import { embed } from 'ai'

export type GeneSearchResult = Pick<SelectGene, 'id' | 'name' | 'symbol'> & {
  similarity?: number
}

export async function searchGenes(
  query: string
): Promise<Array<GeneSearchResult>> {
  try {
    if (query.trim().length === 0) return []

    // Check if the query is an ENST or ENSMUST
    if (/^(ENST|ENSMUST)\d+$/.test(query)) {
      const gene = await searchGeneByENST(query)
      return gene ? [gene] : []
    }

    // Check if the query is an ENSG or ENSMUSG
    if (/^(ENSG|ENSMUG)\d+$/.test(query)) {
      const gene = await searchGeneByENSG(query)
      return gene ? [gene] : []
    }

    // Default search using cosine distance
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

async function searchGeneByENST(
  enst: string
): Promise<GeneSearchResult | undefined> {
  try {
    const [isoform] = await db
      .select({
        geneId: isoforms.geneId,
      })
      .from(isoforms)
      .where(eq(isoforms.ENST, enst))
      .limit(1)

    if (!isoform) return undefined

    const [gene] = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
      })
      .from(genes)
      .where(eq(genes.id, isoform.geneId))
      .limit(1)

    return gene
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function searchGeneByENSG(
  ensg: string
): Promise<GeneSearchResult | undefined> {
  try {
    const [gene] = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
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
