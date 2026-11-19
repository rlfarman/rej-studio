import { AAV_CDS_TIER_LIMITS } from '@/lib/bio/aav'

export type Suitability = 'single-aav' | 'dual-aav' | 'triple-aav'

/**
 * AAV packaging is a *categorical* axis, not a quality ramp. Single/dual/triple
 * are three valid design paths — the app exists to serve dual and triple cases.
 * Colors come from dedicated categorical tokens (see globals.css) so they read
 * as distinct options rather than good/warn/bad: violet, teal and plum, none
 * of which the app uses for success, warning or danger, so the column cannot
 * be scanned as a quality scale. Badge text uses the `-soft`
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

/**
 * How many vectors a coding sequence needs, from the packaging arithmetic in
 * `@/lib/bio/aav`: each fragment travels in its own cassette, so a vector
 * carries `AAV_CDS_CAPACITY_BP` of CDS and the tiers fall at one and two
 * vectors' worth.
 */
export function assessDesignSuitability(cds: string): Suitability {
  const len = cds.length
  if (len <= AAV_CDS_TIER_LIMITS.single) return 'single-aav'
  if (len <= AAV_CDS_TIER_LIMITS.dual) return 'dual-aav'
  return 'triple-aav'
}
