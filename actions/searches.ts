'use server'

import { db } from '@/drizzle/db'
import { genes, searches } from '@/drizzle/schema'
import { desc, eq } from 'drizzle-orm'

export async function createSearch({
  query,
  geneId,
  userId,
}: {
  query: string
  geneId: string
  userId: string
}) {
  try {
    await db.insert(searches).values({
      query,
      geneId,
      userId,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getRecentSearchedGenes({
  userId,
}: {
  userId: string
}) {
  try {
    return db
      .selectDistinctOn([searches.geneId], {
        id: genes.id,
        searchCreatedAt: searches.createdAt,
        symbol: genes.symbol,
        name: genes.name,
      })
      .from(searches)
      .innerJoin(genes, eq(searches.geneId, genes.id))
      .where(eq(searches.userId, userId))
      .orderBy(searches.geneId, desc(searches.createdAt))
      .limit(6)
  } catch (error) {
    console.error(error)
    throw error
  }
}
