import 'server-only'
import { z } from 'zod'
import { cache } from 'react'
import { fetchIsoformAndGeneForMap } from './isoform-query'
import { findCpgIslands } from '@/lib/bio/cpg-islands'
import { findRestrictionSites } from '@/lib/bio/restriction-sites'
import { gcWindow, suitabilityHeatWindow } from '@/lib/bio/windowed-metrics'
import { fetchExonStructure } from './ensembl'
import type { GeneMapPayload } from './types'

const idSchema = z.string().min(1).max(100)

const WINDOW_STEP = 8

async function buildGeneMapPayloadUncached(
  isoformId: string,
): Promise<GeneMapPayload | null> {
  const row = await fetchIsoformAndGeneForMap(isoformId)
  if (!row) return null

  const cds = row.isoform.codingSequence
  if (!cds || cds.length < 3) return null

  const [exonStructure, gc, suitability] = await Promise.all([
    fetchExonStructure(isoformId),
    Promise.resolve(gcWindow(cds, 32, WINDOW_STEP)),
    Promise.resolve(suitabilityHeatWindow(cds, 120, WINDOW_STEP)),
  ])

  return {
    isoform: {
      id: row.isoform.id,
      geneId: row.isoform.geneId,
      species: row.isoform.species,
      codingSequence: cds,
      codingSequenceLength: cds.length,
    },
    gene: {
      id: row.gene.id,
      symbol: row.gene.symbol,
      name: row.gene.name,
    },
    exonStructure,
    tracks: {
      step: WINDOW_STEP,
      count: gc.values.length,
      gc: Array.from(gc.values),
      suitability: Array.from(suitability.values),
    },
    cpgIslands: findCpgIslands(cds),
    restrictionSites: findRestrictionSites(cds),
  }
}

export const buildGeneMapPayload = cache(async (isoformId: string) => {
  const validated = idSchema.parse(isoformId)
  return buildGeneMapPayloadUncached(validated)
})
