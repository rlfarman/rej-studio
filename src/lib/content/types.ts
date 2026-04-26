import type { Suitability } from '@/lib/bio/design-suitability'

// Disease-association rows are baked in by the emit step. The shape is owned
// by the disease-associations feature; lib/ stays feature-agnostic by using
// `unknown` here. Consumers in app/ or features/ cast back to AssociationRow.
export type ContentAssociation = unknown

/**
 * Per-isoform shape emitted to genes-meta/<bucket>.json. Sequences live in
 * sequences/<bucket>.json and are lazy-loaded on demand. proteinSequenceLength
 * is derived from codingSequenceLength on read.
 */
export interface ContentIsoform {
  id: string
  geneId: string
  codingSequenceLength: number
  proteinSequenceLength: number
  species: string
  // Precomputed at emit time so the gene page renders without scanning
  // sequences and keeps RSC payloads tiny.
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitability: Suitability
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
  alternateSymbols: string[]
  isoforms: ContentIsoform[]
  identityMatrix: ContentIdentityMatrix
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

export type IsoformIndexEntry = {
  symbol: string
  species: string
  bucket: string
}
export type IsoformIndex = Record<string, IsoformIndexEntry>
