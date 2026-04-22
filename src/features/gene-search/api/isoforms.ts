'use server'

import { cache } from 'react'
import {
  fetchIsoformsByGene,
  fetchIsoformAndGeneByIsoformId,
} from '@/features/gene-search/api/isoform-queries'
import { z } from 'zod'

// Ensembl gene/transcript IDs are bounded strings. Validate length + type
// at the server-action boundary even though call-sites pass typed values.
const geneIdSchema = z.string().min(1).max(100)
const isoformIdSchema = z.string().min(1).max(100)

// Wrap with React cache() to deduplicate identical calls within a single
// server request (e.g. if a layout and page both need the same isoforms).
const cachedFetchIsoformsByGene = cache(fetchIsoformsByGene)
const cachedFetchIsoformAndGene = cache(fetchIsoformAndGeneByIsoformId)

export async function getIsoformsByGene(geneId: string) {
  const validatedGeneId = geneIdSchema.parse(geneId)
  return cachedFetchIsoformsByGene(validatedGeneId)
}

export async function getIsoformAndGeneByIsoformId(isoformId: string) {
  const validatedIsoformId = isoformIdSchema.parse(isoformId)
  return cachedFetchIsoformAndGene(validatedIsoformId)
}
