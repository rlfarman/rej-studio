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

export type AssociationRow = {
  symbol: string
  name: string
  ensemblGeneId: string | null
  inheritance: string[]
  phenotypes: Phenotype[]
  /**
   * Largest `coding_sequence_length` across this gene's human isoforms, or
   * null if no isoform is present in the seed. Baked into associations.json at
   * build time by `scripts/enrich-disease-associations.ts`.
   */
  largestCds: number | null
}

export type AssociationData = {
  rows: AssociationRow[]
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

export const FILTER_INHERITANCE_BUCKETS = [
  'Autosomal dominant',
  'Autosomal recessive',
  'X-linked',
  'Y-linked',
  'Mitochondrial',
  'Somatic mutation',
  'Digenic',
] as const satisfies readonly InheritanceBucket[]

export function formatInheritanceLabel(bucket: InheritanceBucket | string): string {
  if (bucket === 'Autosomal dominant') return 'Dominant'
  if (bucket === 'Autosomal recessive') return 'Recessive'
  return bucket
}
