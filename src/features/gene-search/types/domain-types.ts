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

// Shape every per-isoform UI consumer agrees on. proteinSequenceLength is
// derived from codingSequenceLength on read (no separate column shipped).
// proteinSequence is no longer carried — the only consumer (the identity
// matrix) reads a precomputed matrix instead.
export interface IsoformListItem {
  id: string
  codingSequence: string
  codingSequenceLength: number
  proteinSequenceLength: number
  species: string
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
