export type Suitability = 'single-aav' | 'dual-aav' | 'triple-aav'

/**
 * AAV packaging is a *categorical* axis, not a quality ramp. Single/dual/triple
 * are three valid design paths — the app exists to serve dual and triple cases.
 * Colors come from dedicated categorical tokens (see globals.css) so they read
 * as distinct options rather than good/warn/bad. Badge text uses the `-soft`
 * tokens in both modes: they're tuned to pass 4.5:1 on the 15% tint.
 */
const SUITABILITY_CONFIG = {
  'single-aav': {
    label: 'Single AAV',
    short: '1×',
    dotClass: 'bg-aav-single',
    textClass: 'text-aav-single-soft',
    fillClass: 'bg-aav-single/70',
    badgeClass: 'border-transparent bg-aav-single/15 text-aav-single-soft',
  },
  'dual-aav': {
    label: 'Dual AAV',
    short: '2×',
    dotClass: 'bg-aav-dual',
    textClass: 'text-aav-dual-soft',
    fillClass: 'bg-aav-dual/70',
    badgeClass: 'border-transparent bg-aav-dual/15 text-aav-dual-soft',
  },
  'triple-aav': {
    label: 'Triple AAV',
    short: '3×',
    dotClass: 'bg-aav-triple',
    textClass: 'text-aav-triple-soft',
    fillClass: 'bg-aav-triple/70',
    badgeClass: 'border-transparent bg-aav-triple/15 text-aav-triple-soft',
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
