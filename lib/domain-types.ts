import type { SelectGene, SelectIsoform } from '@/drizzle/schema'

export type SavedGene = Pick<SelectGene, 'id' | 'name' | 'symbol'>

export type IsoformListItem = Pick<
  SelectIsoform,
  | 'id'
  | 'codingSequence'
  | 'proteinSequence'
  | 'codingSequenceLength'
  | 'proteinSequenceLength'
  | 'species'
  | 'defaultFivePrimeSequence'
  | 'defaultThreePrimeSequence'
> & {
  enst: SelectIsoform['ENST']
}
