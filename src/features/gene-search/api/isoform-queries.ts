import 'server-only'
import { getDb } from '@/drizzle/db'
import { genes, isoforms } from '@/drizzle/schema'
import { count, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

/**
 * Cached isoform queries. Gene/isoform data is read-only (only changes on
 * re-seed), so these use the shared remote cache with the 'max' lifetime
 * (see the cache-tier note in gene-queries.ts) and are tagged 'genes' so a
 * reseed can invalidate everything via `revalidateTag('genes')`.
 */

const GENES_CACHE_TAG = 'genes'

export async function fetchIsoformsByGene(geneId: string) {
  'use cache: remote'
  cacheTag(GENES_CACHE_TAG)
  cacheLife('max')

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

/**
 * Isoform count and species for a gene, without the sequences. The OG image
 * only needs these, and the full isoform rows can run to megabytes.
 */
export async function fetchIsoformSummaryByGene(
  geneId: string,
): Promise<{ isoformCount: number; species: string[] }> {
  'use cache: remote'
  cacheTag(GENES_CACHE_TAG)
  cacheLife('max')

  const db = await getDb()
  const rows = await db
    .select({ species: isoforms.species, count: count() })
    .from(isoforms)
    .where(eq(isoforms.geneId, geneId))
    .groupBy(isoforms.species)
    .orderBy(isoforms.species)

  return {
    isoformCount: rows.reduce((total, row) => total + row.count, 0),
    species: rows.map((row) => row.species),
  }
}

export async function fetchIsoformAndGeneByIsoformId(isoformId: string) {
  'use cache: remote'
  cacheTag(GENES_CACHE_TAG)
  cacheLife('max')

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
