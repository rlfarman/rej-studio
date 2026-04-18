import 'server-only'
import { getDb } from '@/drizzle/db'
import { genes, isoforms } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { cacheLife } from 'next/cache'

/**
 * Gene-map-scoped isoform lookup. Returns the isoform's full coding sequence
 * plus the parent gene's display fields in a single join. Mirrors the shape
 * used by gene-search but scoped to this feature to respect ESLint's
 * cross-feature import boundary.
 */
export async function fetchIsoformAndGeneForMap(isoformId: string) {
  'use cache'
  cacheLife({ revalidate: 300 })

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
