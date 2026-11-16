import 'server-only'
import { getDb } from '@/drizzle/db'
import { genes, isoforms } from '@/drizzle/schema'
import { count, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import { getServerCorpus } from './static-gene-data'

/**
 * Cached isoform queries, answered from the static corpus when one is
 * configured and from Postgres otherwise (see the backend note in
 * gene-queries.ts). Gene/isoform data is read-only (only changes on
 * re-seed), so these use the shared remote cache with the 'max' lifetime
 * (see the cache-tier note in gene-queries.ts) and are tagged 'genes' so a
 * reseed can invalidate everything via `revalidateTag('genes')`.
 */

const GENES_CACHE_TAG = 'genes'

interface IsoformWithGene {
  isoform: {
    id: string
    species: string
    geneId: string
    codingSequence: string
  }
  gene: { id: string; name: string; symbol: string }
}

export async function fetchIsoformsByGene(
  geneId: string,
): Promise<IsoformListItem[]> {
  'use cache: remote'
  cacheTag(GENES_CACHE_TAG)
  cacheLife('max')

  const corpus = getServerCorpus()
  if (corpus) return (await corpus.geneFile(geneId))?.isoforms ?? []

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

  const corpus = getServerCorpus()
  if (corpus) {
    const isoforms = (await corpus.geneFile(geneId))?.isoforms ?? []
    return {
      isoformCount: isoforms.length,
      species: [...new Set(isoforms.map((isoform) => isoform.species))].sort(),
    }
  }

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

export async function fetchIsoformAndGeneByIsoformId(
  isoformId: string,
): Promise<IsoformWithGene | undefined> {
  'use cache: remote'
  cacheTag(GENES_CACHE_TAG)
  cacheLife('max')

  const corpus = getServerCorpus()
  if (corpus) {
    const geneId = await corpus.geneIdOfTranscript(isoformId)
    const gene = geneId ? await corpus.geneFile(geneId) : null
    const isoform = gene?.isoforms.find(({ id }) => id === isoformId)
    if (!gene || !isoform) return undefined
    return {
      isoform: {
        id: isoform.id,
        species: isoform.species,
        geneId: gene.id,
        codingSequence: isoform.codingSequence,
      },
      gene: { id: gene.id, name: gene.name, symbol: gene.symbol },
    }
  }

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
