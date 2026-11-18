import { rankInducibleWggwByBalance } from '@/lib/bio/sequence-utils'
import {
  groupWggwSites,
  nearestSiteIndex,
} from '@/features/design-tool/components/splice-slider/sequence-helpers'
import type { WggwSiteCandidate } from '@/features/design-tool/components/splice-slider/types'

/**
 * All WGGW sites the splice slider offers, in display order.
 *
 * Same pipeline the slider uses, extracted so the default selection can be
 * tested without rendering the component.
 */
export function listWggwSites(sequence: string): WggwSiteCandidate[] {
  return groupWggwSites(rankInducibleWggwByBalance(sequence))
}

/**
 * The site to preselect for a split point: the one nearest the caret.
 *
 * The inspector used to sit empty until the user found and clicked a 1px
 * tick. The backend already moves the split to a WGGW motif near the
 * requested position when none is given (`ensure_wggw`), so preselecting
 * the nearest one shows what would happen anyway, and makes the motif and
 * its synonymous rewrites reviewable before submitting.
 */
export function pickDefaultWggwSite(
  sites: WggwSiteCandidate[],
  position: number,
): WggwSiteCandidate | null {
  const index = nearestSiteIndex(sites, position)
  return index === -1 ? null : (sites[index] ?? null)
}
