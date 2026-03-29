'use server'

import { db } from '@/drizzle/db'
import { genes } from '@/drizzle/schema'

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
