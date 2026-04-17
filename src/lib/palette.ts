export const PALETTES = [
  { value: 'helix', label: 'Helix', hint: 'Indigo + lime' },
  { value: 'codon', label: 'Codon', hint: 'Coral + teal' },
  { value: 'nucleotide', label: 'Nucleotide', hint: 'A / T / G / C' },
  { value: 'modal', label: 'Modal', hint: 'Violet + mint' },
  { value: 'chromatograph', label: 'Chromatograph', hint: 'Teal + magenta' },
] as const

export type PaletteValue = (typeof PALETTES)[number]['value']

export const DEFAULT_PALETTE: PaletteValue = 'helix'
export const PALETTE_STORAGE_KEY = 'rej-palette'
