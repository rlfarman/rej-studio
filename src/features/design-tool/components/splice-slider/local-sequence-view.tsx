import { useLayoutEffect, useRef, useState } from 'react'
import type { WggwRecodingOption } from '@/lib/bio/sequence-utils'
import { CodonCard } from './codon-card'
import { STRIP_SMOOTH_SCROLL_THRESHOLD_BP } from './constants'
import type { SequenceContext, WggwSiteCandidate } from './types'

export function LocalSequenceView({
  ctx,
  sites,
  selectedSites,
  currentRewrites,
  activeSearchMatch,
  cursorPositions,
  activeSpliceIndex,
  stripRef,
  onSelectSite,
}: {
  ctx: SequenceContext
  sites: WggwSiteCandidate[]
  selectedSites: (WggwSiteCandidate | null)[]
  currentRewrites: (WggwRecodingOption | null)[]
  activeSearchMatch: { start: number; length: number } | null
  cursorPositions: number[]
  activeSpliceIndex: number
  stripRef: React.RefObject<HTMLDivElement | null>
  onSelectSite: (site: WggwSiteCandidate) => void
}) {
  const [hoveredSitePosition, setHoveredSitePosition] = useState<number | null>(
    null,
  )

  const selectedCoverByBase = coverBySelectedSite(selectedSites)
  const otherSiteCoverByBase = coverByOtherSite(sites, selectedSites)
  const motifSitesByBase = sitesByBase(sites)
  const selectedSiteIndexByPosition = spliceIndexBySitePosition(selectedSites)
  const changedBases = changedBasesBySplice(selectedSites, currentRewrites)
  const searchMatchBases = basesInMatch(activeSearchMatch)

  const seqLen = ctx.end - ctx.start + 1
  const focusPosition = cursorPositions[activeSpliceIndex] ?? cursorPositions[0]
  // Smooth scroll only on "big jumps" (active-splice switch, midpoint, [/],
  // GoTo). Drag emits per-frame focus updates with small deltas — those
  // stay instant since the slider's pointer handler already imperatively
  // scrolled the strip in the same frame.
  const lastFocusRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    const scroller = stripRef.current
    if (!scroller || seqLen <= 0 || focusPosition == null) return
    const targetCenter =
      ((focusPosition - ctx.start + 0.5) / seqLen) * scroller.scrollWidth
    const left = targetCenter - scroller.clientWidth / 2
    const prev = lastFocusRef.current
    const isBigJump =
      prev !== null &&
      Math.abs(focusPosition - prev) > STRIP_SMOOTH_SCROLL_THRESHOLD_BP
    if (isBigJump) {
      scroller.scrollTo({ left, behavior: 'smooth' })
    } else {
      scroller.scrollLeft = left
    }
    lastFocusRef.current = focusPosition
    const onResize = () => {
      const t =
        ((focusPosition - ctx.start + 0.5) / seqLen) * scroller.scrollWidth
      scroller.scrollLeft = t - scroller.clientWidth / 2
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [stripRef, focusPosition, ctx.start, seqLen])

  return (
    // Single scroller on the rounded card itself. Asymmetric vertical
    // padding (more bottom than top) keeps the horizontal scrollbar in
    // its own space below the bases — on platforms with overlay
    // scrollbars (macOS) the bar sits over padding rather than the
    // base letters at the bottom of each card.
    <div
      ref={stripRef}
      role="group"
      aria-label="Sequence context around WGGW split site"
      className="[scrollbar-width:none] overflow-x-auto rounded-2xl border bg-muted/40 px-5 py-1 font-mono type-nano leading-none [-ms-overflow-style:none] sm:py-2 [&::-webkit-scrollbar]:hidden"
      onPointerLeave={() => setHoveredSitePosition(null)}
    >
      <div className="flex items-stretch">
        {ctx.codons.map((codon, codonIdx) => (
          <CodonCard
            key={codon.idx}
            codon={codon}
            selectedCoverByBase={selectedCoverByBase}
            otherSiteCoverByBase={otherSiteCoverByBase}
            motifSitesByBase={motifSitesByBase}
            selectedSiteIndexByPosition={selectedSiteIndexByPosition}
            changedBases={changedBases}
            searchMatchBases={searchMatchBases}
            hoveredSitePosition={hoveredSitePosition}
            isLast={codonIdx === ctx.codons.length - 1}
            onHoverSite={setHoveredSitePosition}
            onSelectSite={onSelectSite}
          />
        ))}
      </div>
    </div>
  )
}

// For each base position, which selected splice index (if any) covers it.
// Selected sites win over unselected; among selected, lower splice index
// wins (splice 1 takes priority on overlapping bases).
function coverBySelectedSite(selectedSites: (WggwSiteCandidate | null)[]) {
  const map = new Map<
    number,
    { spliceIndex: number; site: WggwSiteCandidate }
  >()
  selectedSites.forEach((site, spliceIndex) => {
    if (!site) return
    for (let k = 0; k < 4; k++) {
      const pos = site.motifStart + k
      if (!map.has(pos)) map.set(pos, { spliceIndex, site })
    }
  })
  return map
}

// Other (non-selected) sites' base coverage, used for hover affordance.
function coverByOtherSite(
  sites: WggwSiteCandidate[],
  selectedSites: (WggwSiteCandidate | null)[],
) {
  const map = new Map<number, WggwSiteCandidate>()
  const selectedPositions = new Set(
    selectedSites.filter((s) => s).map((s) => s!.position),
  )
  for (const site of sites) {
    if (selectedPositions.has(site.position)) continue
    for (let k = 0; k < 4; k++) {
      const pos = site.motifStart + k
      if (!map.has(pos)) map.set(pos, site)
    }
  }
  return map
}

function sitesByBase(sites: WggwSiteCandidate[]) {
  const map = new Map<number, WggwSiteCandidate[]>()
  for (const site of sites) {
    for (let k = 0; k < 4; k++) {
      const pos = site.motifStart + k
      const entries = map.get(pos)
      if (entries) entries.push(site)
      else map.set(pos, [site])
    }
  }
  return map
}

function spliceIndexBySitePosition(
  selectedSites: (WggwSiteCandidate | null)[],
) {
  const map = new Map<number, number>()
  selectedSites.forEach((site, spliceIndex) => {
    if (site) map.set(site.position, spliceIndex)
  })
  return map
}

/** Base position → index of the splice whose rewrite changes it. */
function changedBasesBySplice(
  selectedSites: (WggwSiteCandidate | null)[],
  currentRewrites: (WggwRecodingOption | null)[],
) {
  const s = new Map<number, number>()
  selectedSites.forEach((site, spliceIndex) => {
    const rewrite = currentRewrites[spliceIndex]
    if (!site || !rewrite) return
    for (let i = 0; i < site.originalHexamer.length; i++) {
      if (site.originalHexamer[i] !== rewrite.newHexamer[i]) {
        s.set(site.hexamerStart + i, spliceIndex)
      }
    }
  })
  return s
}

function basesInMatch(match: { start: number; length: number } | null) {
  const s = new Set<number>()
  if (!match) return s
  for (let i = 0; i < match.length; i++) s.add(match.start + i)
  return s
}
