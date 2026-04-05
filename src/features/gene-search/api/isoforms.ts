'use server'

import { db } from '@/drizzle/db'
import { genes, isoforms } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

// Ensembl gene/transcript IDs are bounded strings. Validate length + type
// at the server-action boundary even though call-sites pass typed values.
const geneIdSchema = z.string().min(1).max(100)
const isoformIdSchema = z.string().min(1).max(100)

export async function getIsoformsByGene(geneId: string) {
  const validatedGeneId = geneIdSchema.parse(geneId)
  return db
    .select({
      id: isoforms.id,
      codingSequenceLength: isoforms.codingSequenceLength,
      proteinSequenceLength: isoforms.proteinSequenceLength,
      codingSequence: isoforms.codingSequence,
      proteinSequence: isoforms.proteinSequence,
      species: isoforms.species,
    })
    .from(isoforms)
    .where(eq(isoforms.geneId, validatedGeneId))
    .orderBy(isoforms.id)
}

export async function getIsoformAndGeneByIsoformId(isoformId: string) {
  const validatedIsoformId = isoformIdSchema.parse(isoformId)
  const [result] = await db
    .select({
      isoform: {
        id: isoforms.id,
        species: isoforms.species,
        geneId: isoforms.geneId,
        codingSequence: isoforms.codingSequence,
      },
      gene: {
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
      },
    })
    .from(isoforms)
    .innerJoin(genes, eq(isoforms.geneId, genes.id))
    .where(eq(isoforms.id, validatedIsoformId))
    .limit(1)

  return result
}
