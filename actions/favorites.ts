'use server'

import { db } from '@/drizzle/db'
import { favorites, genes } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'

export const addFavorite = async ({
  geneId,
  userId,
}: {
  geneId: string
  userId: string
}) => {
  try {
    await db.insert(favorites).values({
      userId,
      geneId,
    })
  } catch (error) {
    console.error('Error adding favorite:', error)
    throw error
  }
}

export const removeFavorite = async ({
  geneId,
  userId,
}: {
  geneId: string
  userId: string
}) => {
  try {
    await db
      .delete(favorites)
      .where(and(eq(favorites.geneId, geneId), eq(favorites.userId, userId)))
  } catch (error) {
    console.error('Error removing favorite:', error)
    throw error
  }
}

export const isFavoriteGene = async ({
  geneId,
  userId,
}: {
  geneId: string
  userId: string
}) => {
  try {
    const favorite = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.geneId, geneId), eq(favorites.userId, userId)))
      .limit(1)
    return !!favorite[0]
  } catch (error) {
    console.error('Error checking favorite status:', error)
    throw error
  }
}

export const getFavorites = async ({ userId }: { userId: string }) => {
  try {
    return db
      .select({
        id: genes.id,
        symbol: genes.symbol,
        name: genes.name,
      })
      .from(favorites)
      .innerJoin(genes, eq(favorites.geneId, genes.id))
      .where(eq(favorites.userId, userId))
  } catch (error) {
    console.error('Error fetching favorites:', error)
    throw error
  }
}
