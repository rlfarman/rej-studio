'use server'

import { db } from '@/drizzle/db'
import { genes, isoforms } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function getIsoformsByGene(geneId: string) {
  try {
    const isoformData = await db
      .select({
        id: isoforms.id,
        enst: isoforms.ENST,
        codingSequenceLength: isoforms.codingSequenceLength,
        codingSequence: isoforms.codingSequence,
        proteinSequence: isoforms.proteinSequence,
        species: isoforms.species,
      })
      .from(isoforms)
      .where(eq(isoforms.geneId, geneId))
      .orderBy(isoforms.ENST)

    return isoformData
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getIsoformAndGeneByIsoformId(isoformId: string) {
  try {
    const [result] = await db
      .select({
        isoform: {
          id: isoforms.id,
          enst: isoforms.ENST,
          species: isoforms.species,
          geneId: isoforms.geneId,
          codingSequence: isoforms.codingSequence,
        },
        gene: {
          id: genes.id,
          name: genes.name,
          symbol: genes.symbol,
          ENSG: genes.ENSG,
          chromosome: genes.chromosome,
        },
      })
      .from(isoforms)
      .innerJoin(genes, eq(isoforms.geneId, genes.id))
      .where(eq(isoforms.id, isoformId))
      .limit(1)

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}
