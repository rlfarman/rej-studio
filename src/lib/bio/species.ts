import { z } from 'zod'

const speciesSchema = z.enum(['human', 'mouse'])
export const speciesFilterSchema = z.enum(['human', 'mouse', 'both'])

export type Species = z.infer<typeof speciesSchema>
export type SpeciesFilter = z.infer<typeof speciesFilterSchema>

export const SPECIES_DISPLAY_NAME: Record<Species, string> = {
  human: 'Human',
  mouse: 'Mouse',
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
