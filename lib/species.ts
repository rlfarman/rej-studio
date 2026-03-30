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
