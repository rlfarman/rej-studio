export type Suitability = 'single-aav' | 'dual-aav' | 'triple-aav'

const SUITABILITY_CONFIG = {
  'single-aav': { label: 'Single AAV', variant: 'default' },
  'dual-aav': { label: 'Dual AAV', variant: 'secondary' },
  'triple-aav': { label: 'Triple AAV', variant: 'destructive' },
} as const

export function getSuitabilityConfig(suitability: Suitability) {
  return SUITABILITY_CONFIG[suitability]
}

export function assessDesignSuitability(cds: string): Suitability {
  const len = cds.length
  if (len < 4000) return 'single-aav'
  if (len < 8000) return 'dual-aav'
  return 'triple-aav'
}
