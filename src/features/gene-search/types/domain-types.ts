import type { SelectGene, SelectIsoform } from '@/drizzle/schema'

export type SavedGene = Pick<SelectGene, 'id' | 'name' | 'symbol'> & {
  species?: string
  matchedIsoformId?: string
  // True when this entry was added by the seed-data demo action. Used to
  // scope the "Clear seed data" action and to exclude demo rows from
  // user-data exports.
  isSeed?: boolean
}

export type IsoformListItem = Pick<
  SelectIsoform,
  | 'id'
  | 'codingSequence'
  | 'proteinSequence'
  | 'codingSequenceLength'
  | 'proteinSequenceLength'
  | 'species'
>

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
