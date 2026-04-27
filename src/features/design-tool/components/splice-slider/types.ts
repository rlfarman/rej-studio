import type {
  RankedInducibleWggwCandidate,
  WggwRecodingOption,
} from '@/lib/bio/sequence-utils'

export type CodonRole = 'start' | 'stop' | 'internal-stop' | 'split' | 'context'

export interface WggwSiteCandidate extends RankedInducibleWggwCandidate {
  rewriteOptions: WggwRecodingOption[]
}

export interface SequenceContext {
  start: number
  end: number
  bases: {
    base: string
    position: number
    role: CodonRole
  }[]
  codons: {
    codon: string
    aa: string | null
    idx: number
    start: number
    end: number
    role: CodonRole
  }[]
}
