import { Isoform } from './isoform'

export type HumanENSG = `ENSG${number}`
export type MouseENSG = `ENSMUSG${number}`
export type ENSG = HumanENSG | MouseENSG

export interface Gene {
  symbol: string
  name: string
  ENSG: ENSG
  chromosome: string
  isoforms: Isoform[]
  diseaseAssociations: string[] | null
}
