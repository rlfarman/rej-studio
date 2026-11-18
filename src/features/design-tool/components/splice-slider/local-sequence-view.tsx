import { useLayoutEffect, useRef, useState } from 'react'
import type { WggwRecodingOption } from '@/lib/bio/sequence-utils'
import { designToolCopy } from '../../copy'
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
  // Roving tabindex over the candidate sites. The strip holds one tab stop,
  // and arrows / Home / End move it between sites; Enter or Space selects
  // (the stop is a real button, so that comes for free). `basedOn` records
  // which selection the roving stop was set against, so a selection made by
  // any other route ([ ], a tick click, a drag) pulls the stop back onto the
  // site the design is actually using.
  const [roving, setRoving] = useState<{
    site: number
    basedOn: number | null
  } | null>(null)
  const sitePositions = sites.map((site) => site.position)
  const selectedSitePosition =
    selectedSites[activeSpliceIndex]?.position ??
    selectedSites.find((site) => site)?.position ??
    null
  const rovingSitePosition =
    roving !== null &&
    roving.basedOn === selectedSitePosition &&
    sitePositions.includes(roving.site)
      ? roving.site
      : (selectedSitePosition ?? sitePositions[0] ?? null)

  const moveRoving = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (sitePositions.length === 0) return
    const current =
      rovingSitePosition === null
        ? -1
        : sitePositions.indexOf(rovingSitePosition)
    const last = sitePositions.length - 1
    let next: number | undefined
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = sitePositions[Math.min(last, current + 1)]
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = sitePositions[Math.max(0, current - 1)]
        break
      case 'Home':
        next = sitePositions[0]
        break
      case 'End':
        next = sitePositions[last]
        break
      default:
        return
    }
    event.preventDefault()
    // The editor's own window shortcuts and the slider track must not also
    // act on these keys.
    event.stopPropagation()
    if (next === undefined) return
    const target = stripRef.current?.querySelector<HTMLElement>(
      `[data-site-start="${next}"]`,
    )
    // Only move the stop onto a site that is actually rendered as one, so
    // the strip never ends up with no tab stop at all.
    if (!target) return
    setRoving({ site: next, basedOn: selectedSitePosition })
    target.focus()
    target.scrollIntoView({ block: 'nearest', inline: 'center' })
  }

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
    //
    // The roving-tabindex pattern: the strip owns one tab stop and routes
    // arrow keys to the site buttons inside it, which are the interactive
    // elements. Binding the handler to each button instead would add a
    // listener per candidate site (457 on BRCA2) for no behavioural gain.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={stripRef}
      role="group"
      aria-label={designToolCopy.spliceEditor.contextAria}
      aria-describedby="wggw-strip-keys"
      className="[scrollbar-width:none] overflow-x-auto rounded-2xl border bg-muted/40 px-5 py-1 font-mono type-nano leading-none [-ms-overflow-style:none] sm:py-2 [&::-webkit-scrollbar]:hidden"
      onPointerLeave={() => setHoveredSitePosition(null)}
      onKeyDown={moveRoving}
    >
      <p id="wggw-strip-keys" className="sr-only">
        {sites.length.toLocaleString()} candidate WGGW sites. Use the left and
        right arrow keys to move between them, Home and End for the first and
        last, and Enter to split here.
      </p>
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
            rovingSitePosition={rovingSitePosition}
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
