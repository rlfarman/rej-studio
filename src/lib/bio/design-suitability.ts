import { appCopy } from '@/lib/copy'

export type Suitability = 'single-aav' | 'dual-aav' | 'triple-aav'

const SUITABILITY_CONFIG = {
  'single-aav': {
    label: appCopy.suitability['single-aav'],
    variant: 'default',
  },
  'dual-aav': { label: appCopy.suitability['dual-aav'], variant: 'secondary' },
  'triple-aav': {
    label: appCopy.suitability['triple-aav'],
    variant: 'destructive',
  },
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
