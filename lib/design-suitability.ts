export type Suitability = 'single' | 'dual' | 'triple'

const SUITABILITY_CONFIG = {
  single: { label: 'Single AAV', variant: 'default' },
  dual: { label: 'Dual AAV', variant: 'secondary' },
  triple: { label: 'Triple AAV', variant: 'destructive' },
} as const

export function getSuitabilityConfig(suitability: Suitability) {
  return SUITABILITY_CONFIG[suitability]
}

export function assessDesignSuitability(cds: string): Suitability {
  const len = cds.length
  if (len < 4000) return 'single'
  if (len < 8000) return 'dual'
  return 'triple'
}
