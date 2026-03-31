import {
  computeGcPercent,
  hasStartCodon,
  getStopCodonStatus,
} from '@/lib/sequence-utils'

export type Suitability = 'easy' | 'moderate' | 'complex' | 'oversized'

const SUITABILITY_CONFIG = {
  easy: { label: 'Easy', variant: 'default' },
  moderate: { label: 'Moderate', variant: 'secondary' },
  complex: { label: 'Complex', variant: 'outline' },
  oversized: { label: 'Oversized', variant: 'destructive' },
} as const

export function getSuitabilityConfig(suitability: Suitability) {
  return SUITABILITY_CONFIG[suitability]
}

export function assessDesignSuitability(cds: string): Suitability {
  const len = cds.length
  if (len > 4700) return 'oversized'

  const gc = computeGcPercent(cds)
  const hasStart = hasStartCodon(cds)
  const stopStatus = getStopCodonStatus(cds)
  const isMultOf3 = len % 3 === 0

  const issues = [
    !hasStart,
    stopStatus !== 'present',
    !isMultOf3,
    gc < 30 || gc > 70,
  ].filter(Boolean).length

  if (issues === 0 && len <= 3000) return 'easy'
  if (issues <= 1) return 'moderate'
  return 'complex'
}
