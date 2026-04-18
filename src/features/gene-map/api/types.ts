import type { CpgIsland } from '@/lib/bio/cpg-islands'
import type { RestrictionHit } from '@/lib/bio/restriction-sites'
import type { ExonStructure } from './ensembl'

export interface GeneMapPayload {
  isoform: {
    id: string
    geneId: string
    species: string
    codingSequence: string
    codingSequenceLength: number
  }
  gene: { id: string; symbol: string; name: string }
  exonStructure: ExonStructure | null
  tracks: {
    step: number
    count: number
    gc: number[]
    suitability: number[]
  }
  cpgIslands: CpgIsland[]
  restrictionSites: RestrictionHit[]
}
