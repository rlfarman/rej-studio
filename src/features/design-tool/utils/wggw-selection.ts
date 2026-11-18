import { rankInducibleWggwByBalance } from '@/lib/bio/sequence-utils'

import { MIN_SEQUENCE_LENGTH } from '../components/splice-slider/constants'
import { groupWggwSites } from '../components/splice-slider/sequence-helpers'
import type { WggwSiteCandidate } from '../components/splice-slider/types'
import type {
  FormValues,
  RewritePick,
  SelectedWggwSite,
} from '../types/form-schema'
import { pickDefaultWggwSite } from './default-wggw-site'

/**
 * Which WGGW site and synonymous rewrite each split point uses, from what the
 * person picked in the split-point editor.
 *
 * The picks are form state the editor writes in its event handlers; what
 * they resolve to is derived, here, by the editor while it renders and by
 * the form once on submit (`selectedWggwSitesFor`). Nothing derived is
 * written back into the form, which is what made typing drop keystrokes.
 */

/** The candidate WGGW sites in a sequence, best first. */
export function wggwSitesIn(sequence: string): WggwSiteCandidate[] {
  return sequence.length < MIN_SEQUENCE_LENGTH
    ? []
    : groupWggwSites(rankInducibleWggwByBalance(sequence))
}

export interface WggwResolution {
  /** Each split's site: the one picked, or the one nearest its caret. */
  sites: (WggwSiteCandidate | null)[]
  /** Each split's chosen rewrite of its site's codons. */
  rewrites: (WggwSiteCandidate['rewriteOptions'][number] | null)[]
}

/**
 * Resolves the picks for each split point. An unpicked split shows the WGGW
 * site nearest its caret rather than nothing: the optimizer would move the
 * split to a nearby motif anyway, so this surfaces that choice for review. A
 * rewrite pick applies only while its split still uses the site it was made
 * for; otherwise the best rewrite (the first) is used.
 */
export function resolveWggwPicks(
  sites: WggwSiteCandidate[],
  positions: number[],
  midpoint: number,
  sitePicks: (number | null)[],
  rewritePicks: RewritePick[],
): WggwResolution {
  const resolvedSites = positions.map((position, i) => {
    const picked = sitePicks[i] ?? null
    return picked !== null
      ? (sites.find((site) => site.position === picked) ?? null)
      : pickDefaultWggwSite(sites, position ?? midpoint)
  })
  const rewrites = resolvedSites.map((site, i) => {
    if (!site) return null
    const pick = rewritePicks[i]
    const index = pick?.position === site.position ? pick.index : 0
    return (
      site.rewriteOptions[Math.min(index, site.rewriteOptions.length - 1)] ??
      null
    )
  })
  return { sites: resolvedSites, rewrites }
}

/** The `selectedWggwSites` the optimizer request carries, for a submit. */
export function selectedWggwSitesFor(
  sequence: string,
  positions: number[],
  sitePicks: (number | null)[] = [],
  rewritePicks: RewritePick[] = [],
): (SelectedWggwSite | null)[] {
  const midpoint = Math.max(
    1,
    Math.min(sequence.length - 1, Math.floor(sequence.length / 2)),
  )
  const { sites, rewrites } = resolveWggwPicks(
    wggwSitesIn(sequence),
    positions,
    midpoint,
    sitePicks,
    rewritePicks,
  )
  return sites.map((site, i) => {
    const rewrite = rewrites[i]
    if (!site || !rewrite) return null
    return {
      position: site.position,
      motifStart: site.motifStart,
      motif: site.motif,
      hexamerStart: site.hexamerStart,
      originalCodons: site.originalCodons,
      newCodons: rewrite.newCodons,
      newHexamer: rewrite.newHexamer,
    }
  })
}

/** The form values with `selectedWggwSites` resolved from the picks. */
export function withSelectedWggwSites(values: FormValues): FormValues {
  return {
    ...values,
    selectedWggwSites: selectedWggwSitesFor(
      values.codingSequence,
      values.spliceJunctionPositions,
      values.wggwSitePicks,
      values.wggwRewritePicks,
    ),
  }
}
