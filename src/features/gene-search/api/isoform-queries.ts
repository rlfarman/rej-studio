import { getDb } from '@/drizzle/db'
import { genes, isoforms } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

/**
 * Cached isoform queries. Gene/isoform data is read-only (only changes on
 * re-seed), so we cache for an hour and tag entries with 'genes' so a
 * reseed can invalidate everything via `revalidateTag('genes')`.
 */

const GENES_CACHE_TAG = 'genes'

export async function fetchIsoformsByGene(geneId: string) {
  'use cache'
  cacheTag(GENES_CACHE_TAG)
  cacheLife({ revalidate: 3600 })

  const db = await getDb()
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
    .where(eq(isoforms.geneId, geneId))
    .orderBy(isoforms.id)
}

export async function fetchIsoformAndGeneByIsoformId(isoformId: string) {
  'use cache'
  cacheTag(GENES_CACHE_TAG)
  cacheLife({ revalidate: 3600 })

  const db = await getDb()
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
    .where(eq(isoforms.id, isoformId))
    .limit(1)

  return result
}
