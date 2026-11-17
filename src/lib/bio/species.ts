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

/** A species filter from a URL, or undefined for anything else. */
export function parseSpeciesParam(value: unknown): SpeciesFilter | undefined {
  return typeof value === 'string' && isSpeciesFilter(value) ? value : undefined
}
