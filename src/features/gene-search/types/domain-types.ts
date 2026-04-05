import type { SelectGene, SelectIsoform } from '@/drizzle/schema'

export type SavedGene = Pick<SelectGene, 'id' | 'name' | 'symbol'> & {
  species?: string
  matchedIsoformId?: string
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
