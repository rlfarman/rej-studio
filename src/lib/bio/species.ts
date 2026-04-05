export type Species = 'human' | 'mouse'
export type SpeciesFilter = Species | 'both'

export const SPECIES_OPTIONS: Species[] = ['human', 'mouse']
export const SPECIES_FILTER_OPTIONS: SpeciesFilter[] = [
  'human',
  'mouse',
  'both',
]

export const SPECIES_DISPLAY_NAME: Record<Species, string> = {
  human: 'Human',
  mouse: 'Mouse',
}

export const SPECIES_FILTER_DISPLAY_NAME: Record<SpeciesFilter, string> = {
  human: 'Humans',
  mouse: 'Mice',
  both: 'Humans & Mice',
}

export function isSpecies(value: string): value is Species {
  return value === 'human' || value === 'mouse'
}

export function isSpeciesFilter(value: string): value is SpeciesFilter {
  return value === 'human' || value === 'mouse' || value === 'both'
}

export function geneHref(symbol: string, species?: string, isoformId?: string) {
  const params = new URLSearchParams()
  if (species) params.set('species', species)
  if (isoformId) params.set('isoform', isoformId)
  const qs = params.toString()
  return qs ? `/genes/${symbol}?${qs}` : `/genes/${symbol}`
}

export function parseSpeciesParam(
  value: string | undefined,
): SpeciesFilter | undefined {
  return value && isSpeciesFilter(value) ? value : undefined
}
