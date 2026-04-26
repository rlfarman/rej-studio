// Disease-association rows are baked in by the emit step. The shape is owned
// by the disease-associations feature; lib/ stays feature-agnostic by using
// `unknown` here. Consumers in app/ or features/ cast back to AssociationRow.
export type ContentAssociation = unknown

export interface ContentIsoform {
  id: string
  geneId: string
  codingSequenceLength: number
  /** Derived from codingSequenceLength on read; not stored in the JSON. */
  proteinSequenceLength: number
  codingSequence: string
  species: string
}

export interface ContentIdentityMatrix {
  ids: string[]
  rows: number[][]
}

export interface ContentGene {
  id: string
  symbol: string
  name: string
  species: string
  alternateSymbols: string
  isoforms: ContentIsoform[]
  identityMatrix: ContentIdentityMatrix
  // Baked-in disease association row, human only. Pre-resolved at emit time
  // so the gene page render does no association lookup. Shape: AssociationRow
  // from src/features/disease-associations/types.
  association?: ContentAssociation
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
