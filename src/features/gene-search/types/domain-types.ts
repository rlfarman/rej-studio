import type { Suitability } from '@/lib/bio/design-suitability'

export interface SavedGene {
  id: string
  name: string
  symbol: string
  species?: string
  matchedIsoformId?: string
  // True when this entry was added by the seed-data demo action. Used to
  // scope the "Clear seed data" action and to exclude demo rows from
  // user-data exports.
  isSeed?: boolean
}

/**
 * Shape every per-isoform UI consumer agrees on. Sequences are NOT carried
 * here — they're lazy-loaded via useIsoformSequence/fetchIsoformSequence
 * when actually needed (row expansion, copy/download, comparison sheet).
 *
 * Default-render metrics are precomputed at emit time so list views render
 * without scanning sequences. proteinSequenceLength is derived from
 * codingSequenceLength on read.
 */
export interface IsoformListItem {
  id: string
  codingSequenceLength: number
  proteinSequenceLength: number
  species: string
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitability: Suitability
}

// Minimal projection of a design-tool job used by the command palette. Kept
// here (not imported from `design-tool`) so the gene-search feature stays
// within its boundary — see ESLint `import/no-restricted-paths`. The app-level
// shell is responsible for mapping the real job store into this shape.
export interface JobSearchItem {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  sequenceLength: number
}
