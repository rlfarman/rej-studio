export interface ContentIsoform {
  id: string
  geneId: string
  codingSequenceLength: number
  proteinSequenceLength: number
  codingSequence: string
  proteinSequence: string
  species: string
}

export interface ContentGene {
  id: string
  symbol: string
  name: string
  species: string
  alternateSymbols: string
  isoforms: ContentIsoform[]
}

export interface ManifestEntry {
  id: string
  symbol: string
  species: string
}

export interface ContentManifest {
  genes: ManifestEntry[]
}

export type IsoformIndexEntry = { symbol: string; species: string }
export type IsoformIndex = Record<string, IsoformIndexEntry>
