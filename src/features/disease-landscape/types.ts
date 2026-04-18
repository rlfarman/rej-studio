export type PhenotypeStatus =
  | 'confirmed'
  | 'provisional'
  | 'susceptibility'
  | 'nondisease'

export type Phenotype = {
  name: string
  mim: number | null
  mappingKey: 1 | 2 | 3 | 4 | null
  inheritance: string | null
  status: PhenotypeStatus
}

export type LandscapeRow = {
  symbol: string
  name: string
  ensemblGeneId: string | null
  inheritance: string[]
  phenotypes: Phenotype[]
}

export type LandscapeData = {
  rows: LandscapeRow[]
}

export const INHERITANCE_BUCKETS = [
  'Autosomal dominant',
  'Autosomal recessive',
  'X-linked',
  'Y-linked',
  'Mitochondrial',
  'Somatic mutation',
  'Digenic',
  'Multifactorial',
  'Isolated cases',
] as const

export type InheritanceBucket = (typeof INHERITANCE_BUCKETS)[number]
