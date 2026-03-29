export type HumanENST = `ENST${number}`
export type MouseENST = `ENSMUST${number}`

export interface Isoform {
  ENST: HumanENST | MouseENST
  length: number
  packagability: number
  species: 'Human' | 'Mouse'
  codingSequence?: string
  proteinSequence?: string
}
