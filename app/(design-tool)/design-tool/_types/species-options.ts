import type { Species } from '@/lib/species'

export type DesignToolSpecies = Species | 'none'

export const DESIGN_TOOL_SPECIES_OPTIONS: Array<{
  value: DesignToolSpecies
  label: string
}> = [
  { value: 'none', label: 'None' },
  { value: 'human', label: 'Human' },
  { value: 'mouse', label: 'Mouse' },
] as const
